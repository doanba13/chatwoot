<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import AiDraftAPI from 'dashboard/api/gotchu/aiDraft';
import DraftDock from './DraftDock.vue';
import DraftInstruct from './DraftInstruct.vue';
import {
  EMPTY_REASONS,
  draftViewFrom,
  errorView,
  loadingView,
} from './helpers/draftView';
import {
  forgetInsertedDraft,
  insertedDraftFor,
  rememberInsertedDraft,
} from './helpers/insertedDraft';

// What the dock is wired to. The dock itself stays props-only — it is the thing
// the design gallery mounts and the thing a spec can drive one state at a time —
// so the reading, the polling and the failure modes live here.
//
// This mounts inside the composer, above the reply editor, which is where
// `docs/gotchu/inbox-spec.md` §Composer has always put it: one bordered
// container holding an optional draft dock above the editor. There is exactly
// one draft surface, and this is it.
const props = defineProps({
  // The DISPLAY id, which is what ReplyBox carries as `currentChat.id` and what
  // the endpoint resolves. See api/gotchu/aiDraft.js.
  conversationId: {
    type: [Number, String],
    required: true,
  },
  // `inbox.channel_type`, used for one decision only: which editor Insert puts
  // the text into. Null means the normal editor, which is the safe way round —
  // markdown pasted into a plain composer is readable, a rich-editor insert into
  // a channel that has no rich editor is not.
  channelType: {
    type: String,
    default: null,
  },
});

/**
 * Whether the gestures that reach a CUSTOMER are reachable from this deployment.
 *
 * Still false everywhere, and still a constant: Send, Discard, the adjustments
 * and stop are hidden unconditionally. A send reaches a customer, the conditions
 * a review wrote for that path are not met, and there is no reason to open it
 * because an instruction is open. The dock hides these rather than disabling
 * them — a disabled button reads as "not yet", which an agent waits for, and a
 * live-looking button that silently does nothing is worse than no button at all.
 *
 * INSTRUCT is no longer one of them, and is no longer decided here. It cannot
 * reach a customer — the route behind it produces a note and a new draft version
 * — so it is driven by `capabilities.instruct` from the read below, which Rails
 * computes from its own env at request time. That is the point of the split:
 * turning instructions on is an env var plus a container restart, never an image
 * rebuild, and it does not turn anything else on with it.
 */
const WRITE_SURFACE_AVAILABLE = false;

/**
 * The cap the field stops at, which is the cap Rails refuses on, which is the cap
 * the gateway refuses on. Mirrored so a supporter cannot type their way into a
 * 422 they have no way to read.
 */
const MAX_INSTRUCTION_CHARS = 2000;

/**
 * What to say about a submission that did not land, by the reason Rails gave.
 *
 * `invalid` is the boundary refusing what the gateway would also refuse.
 * `refused` is the gateway itself answering no — a cycle that moved on, or a
 * write surface switched off behind it, which it deliberately makes
 * indistinguishable, so the sentence fits either and names neither.
 * `unavailable` is "could not confirm", never "did not happen": nothing cancels
 * an enqueue mid-flight, so an instruction reported as failed may still have
 * landed. A failure with no reason on it — a dropped connection, a 500 — says
 * the same thing for the same reason.
 */
const INSTRUCT_ERROR_KEYS = Object.freeze({
  unconfigured: 'GOTCHU.DRAFT.INSTRUCT_UNCONFIGURED',
  refused: 'GOTCHU.DRAFT.INSTRUCT_REFUSED',
  unavailable: 'GOTCHU.DRAFT.INSTRUCT_UNAVAILABLE',
  invalid: 'GOTCHU.DRAFT.INSTRUCT_INVALID',
});

/**
 * How often to re-read, and why this number.
 *
 * There is no push from the reply worker to a browser: no ActionCable event, no
 * SSE, nothing. So this polls, and every tick is a Postgres read behind two HTTP
 * hops (browser → Rails → gateway). The interval is therefore chosen against how
 * fast an agent could possibly notice, not against how fast the data can change.
 *
 * A draft lands seconds after the customer's message and the review window it
 * opens is tens of minutes wide. An agent who has just opened a conversation
 * spends longer than 15 seconds reading what the customer actually wrote, so a
 * draft that appears one tick late appears, to them, immediately. Going faster
 * buys nothing anybody can perceive; going slower starts to read as "the panel
 * is broken" on the conversations where the draft arrives while they watch.
 *
 * The cost side: 4 reads per minute per open conversation, and only while the
 * composer is mounted and the browser tab is in front. Both of those are real
 * limits rather than intentions — see the lifecycle notes below.
 */
const POLL_INTERVAL_MS = 15 * 1000;

const view = ref(loadingView());

/**
 * The version number behind whatever `view.text` currently shows, or null.
 *
 * Not part of `view` — the dock renders none of it — but Insert and the
 * staleness check in `read()` both need the exact number the gateway just
 * returned, to name on a send and to notice when it has moved on.
 */
const draftVersion = ref(null);

/**
 * Whether Rails can forward an instruction at all — its answer, per read, not a
 * guess. False until a read says otherwise, so a browser that has not heard yet,
 * or one whose read failed, offers nothing.
 */
const instructAvailable = ref(false);

// The typed instruction, owned here rather than in the field, because whether it
// survives is an answer about a request this file makes: cleared once the
// instruction is accepted, kept verbatim on every failure. A supporter who typed
// two sentences and lost them to a network blip does not type them again.
const instruction = ref('');
const submitting = ref(false);
// { key, tone } for the last submission, or null. Never an outcome — see below.
const instructNotice = ref(null);

/**
 * The idempotency token for the submission in flight, and the exact text it was
 * minted for.
 *
 * The gateway derives its event key from this token, so the same token twice is
 * ONE instruction and two tokens are two. Both halves of that matter here:
 *
 * - A RETRY of the same submission must reuse it. The failure a supporter
 *   actually retries is "could not confirm", which is precisely the case where
 *   the first attempt may already have landed; a fresh token there is a second
 *   instruction and a second redraft.
 * - A DIFFERENT submission must not. Reuse after the text changed would be
 *   silently swallowed at the far end — the worker answers `duplicate` and
 *   returns — which is a press that does nothing, the failure this whole
 *   surface is built to avoid.
 *
 * So the token is kept only while the text it was minted for is unchanged, and
 * dropped the moment one is accepted.
 */
let pendingRequestId = null;
let pendingText = null;

/**
 * A fresh token. Unguessable is not a requirement: the gateway HMACs it with a
 * credential this browser never holds before it becomes a key, which is exactly
 * why the caller is allowed to choose it. Unique per submission is the
 * requirement.
 *
 * `crypto.randomUUID` is absent outside a secure context, which a self-hosted
 * Chatwoot on plain HTTP is, so there is a fallback. Both shapes satisfy the
 * gateway's token format (8-128 of `A-Za-z0-9_-`).
 */
const newRequestId = () => {
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  const chunk = () => Math.random().toString(36).slice(2, 10).padEnd(8, '0');
  return `${chunk()}-${chunk()}-${chunk()}-${chunk()}`;
};

// Which conversation a read is in flight for, or null. A gateway slower than the
// interval would otherwise stack ticks up behind each other, which is the shape
// of load that turns a slow dependency into a dead one.
//
// Keyed by conversation rather than a bare boolean, and that is not tidiness: a
// boolean here meant that switching conversations DURING a slow read skipped the
// new read altogether, and since the old read's answer is then discarded as
// stale, the dock sat on its loading state until the next tick. The one moment
// the guard fired was the one moment it must not.
let readingFor = null;
let timer = null;

const read = async () => {
  // The conversation this read is asked for. An agent clicking down a list
  // switches conversations faster than a round trip completes, and an answer for
  // the previous customer painted above the next one's editor is the worst thing
  // this surface can do — worse than showing nothing, because it is confidently
  // wrong, nothing about it looks stale, and Insert is one press away.
  const readFor = props.conversationId;
  if (readingFor === readFor) return;
  readingFor = readFor;

  try {
    const { data } = await AiDraftAPI.getDraft(readFor);
    if (readFor !== props.conversationId) return;
    view.value = draftViewFrom(data);
    draftVersion.value =
      Number.isInteger(data?.draft?.version) && data.draft.version > 0
        ? data.draft.version
        : null;
    // Server config, read every time rather than cached: an operator who sets the
    // credential and restarts Rails gets the field within a poll, and one who
    // takes it away loses it just as fast.
    instructAvailable.value = data?.capabilities?.instruct === true;

    // A newer draft can land on this very poll after Insert already handed
    // the old text to the composer — the dock polls every 15s and nothing
    // stops a redraft finishing in between. Stamping that old version on a
    // send would claim the supporter reviewed text they never saw, which is
    // the reply worker's invariant 6, reached here by the browser's own poll
    // instead of a stale approval. Once what the gateway just returned stops
    // matching what Insert remembered, the memory is wrong for any send from
    // here on and has to go quiet rather than carry on.
    const remembered = insertedDraftFor(readFor);
    if (
      remembered &&
      (remembered.cycleId !== view.value.cycleId ||
        remembered.draftVersion !== draftVersion.value)
    ) {
      forgetInsertedDraft(readFor);
    }
  } catch (error) {
    if (readFor !== props.conversationId) return;
    instructAvailable.value = false;
    // 503 is an unconfigured gateway and 502 is a dead one: an operator has to
    // do something about the first and nobody has to do anything about the
    // second. errorView keeps those apart; the notice below says which.
    view.value = errorView(error?.response?.status);
  } finally {
    // Only if this is still the read in flight. A stale read finishing after the
    // agent moved on must not clear the new conversation's slot and let a tick
    // fire a second concurrent read for it.
    if (readingFor === readFor) readingFor = null;
  }
};

const stopPolling = () => {
  if (!timer) return;
  window.clearInterval(timer);
  timer = null;
};

// A hidden tab is a tab nobody is reading, and a laptop lid is closed for hours.
// The read resumes on the way back rather than waiting out the rest of the
// interval, because coming back to a stale dock is exactly when the agent looks.
const tick = () => {
  if (document.hidden) return;
  read();
};

const startPolling = () => {
  stopPolling();
  timer = window.setInterval(tick, POLL_INTERVAL_MS);
};

const onVisibilityChange = () => {
  if (!document.hidden) read();
};

// A fresh read, with the view reset to its loading state first. Both halves
// matter on a conversation change: without the reset the previous customer's
// draft stays above the editor until the new read lands.
const restart = () => {
  view.value = loadingView();
  // The previous conversation's version number is meaningless here — it
  // would otherwise sit stale until the fresh read lands, and Insert reads
  // it directly rather than through `view`.
  draftVersion.value = null;
  // Everything about the previous conversation goes, including a half-typed
  // instruction: it was about another customer's draft. `submitting` is cleared
  // here rather than by the request still in flight for that conversation, which
  // leaves the new field locked by an answer that is no longer about it — the
  // same reasoning as the read guard above.
  instruction.value = '';
  instructNotice.value = null;
  submitting.value = false;
  pendingRequestId = null;
  pendingText = null;
  read();
  startPolling();
};

watch(() => props.conversationId, restart);

// The composer is mounted for as long as the agent is looking at a conversation
// — `ConversationBox` renders `MessagesView` behind `v-if="currentChat.id"` —
// so leaving the conversation view unmounts this and `onBeforeUnmount` stops the
// timer. Switching between conversations keeps it mounted and goes through the
// watcher above instead. The only other way to stop reading is the hidden-tab
// check in `tick`.
onMounted(() => {
  read();
  startPolling();
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(() => {
  stopPolling();
  document.removeEventListener('visibilitychange', onVisibilityChange);
});

// The same two-branch decision Copilot makes for its own "use this reply"
// button. Nothing here touches the editor directly: the editor listens for these
// events, so a draft is inserted the way a canned response or a Copilot
// suggestion is, with whatever the composer does about drafts and length applied
// to it as well.
const insertIntoRichEditor = computed(() =>
  [INBOX_TYPES.WEB, INBOX_TYPES.EMAIL].includes(props.channelType)
);

const onInsert = () => {
  const { text, cycleId } = view.value;
  if (!text) return;

  emitter.emit(
    insertIntoRichEditor.value
      ? BUS_EVENTS.INSERT_INTO_RICH_EDITOR
      : BUS_EVENTS.INSERT_INTO_NORMAL_EDITOR,
    text
  );

  // The composer's own insert funnels (Editor.vue's insertContentIntoEditor
  // / insertSpecialContent for the rich editor and canned responses,
  // ReplyBox's addIntoEditor for the plain one) clear any stamp left over
  // from an earlier draft the moment they receive this event, and mitt
  // delivers it synchronously — so that has already happened by the time
  // this line runs, and recording here, after, is what makes this write the
  // one that stands. DraftDockContainer.spec.js's "records after the insert
  // event fires, not before" pins this ordering: swapping these two
  // statements makes that test fail.
  //
  // A missing version means no stamp at all, not a stamp with a hole in it —
  // the receiver validates both fields as integers and would reject a
  // partial one anyway, so remembering it here would only buy a confusing
  // log line downstream.
  if (Number.isInteger(cycleId) && Number.isInteger(draftVersion.value)) {
    rememberInsertedDraft(props.conversationId, {
      cycleId,
      draftVersion: draftVersion.value,
    });
  }
};

/**
 * Whether there is anything to instruct ABOUT.
 *
 * A draft that is ready, a cycle id to name it by, and a deployment that can
 * forward the gesture. Not while one is being written: the field is about the
 * draft on screen, and there is none.
 */
const canInstruct = computed(
  () =>
    instructAvailable.value &&
    view.value.state === 'ready' &&
    view.value.cycleId !== null
);

const noticeToneOf = key =>
  key === 'GOTCHU.DRAFT.INSTRUCT_ACCEPTED' ? 'success' : 'error';

/**
 * Forward what the supporter typed, and say only what can be known.
 *
 * What comes back is ACCEPTANCE, not an outcome: the reply worker answers as a
 * private note in the conversation, and this browser never hears whether the agent understood the
 * instruction, redrafted, or asked a question back. The one thing that shows up
 * here is a new version on a later poll. So the success line says accepted and
 * says where the answer goes; claiming a redraft would be claiming something
 * nothing in this process observed.
 *
 * NOT followed by an immediate re-read, deliberately. The cycle only turns
 * `redrafting` once the worker picks the job off the queue, which is after this
 * response, so a read fired now returns the state the dock is already showing —
 * and "nothing changed" right after an acceptance reads as the press having done
 * nothing, which is worse than saying nothing. The 15s poll catches the flip
 * inside the window an agent could notice it in, and that is the same argument
 * POLL_INTERVAL_MS is chosen on.
 */
const onInstruct = async () => {
  const text = instruction.value.trim();
  const cycleId = view.value.cycleId;
  if (!text || submitting.value || !canInstruct.value) return;

  // The conversation this submission is for, captured for the same reason a read
  // captures it: an agent clicking down a list switches faster than a round trip,
  // and an answer painted under the next customer's draft is worse than none.
  const submitFor = props.conversationId;

  if (pendingRequestId === null || pendingText !== text) {
    pendingRequestId = newRequestId();
    pendingText = text;
  }

  submitting.value = true;
  instructNotice.value = null;

  try {
    await AiDraftAPI.instruct(submitFor, {
      text,
      cycleId,
      requestId: pendingRequestId,
    });
    if (submitFor !== props.conversationId) return;
    // Accepted, so the token has done its job and the next instruction is a new
    // one. The field is cleared here and nowhere else.
    pendingRequestId = null;
    pendingText = null;
    instruction.value = '';
    instructNotice.value = {
      key: 'GOTCHU.DRAFT.INSTRUCT_ACCEPTED',
      tone: 'success',
    };
  } catch (error) {
    if (submitFor !== props.conversationId) return;
    // The typed text stays exactly where it is, and so does the token: pressing
    // again is a retry of this submission, not a second instruction.
    const key =
      INSTRUCT_ERROR_KEYS[error?.response?.data?.reason] ??
      INSTRUCT_ERROR_KEYS.unavailable;
    instructNotice.value = { key, tone: noticeToneOf(key) };
  } finally {
    if (submitFor === props.conversationId) submitting.value = false;
  }
};

/**
 * The read failures that get a line of their own, and why only these.
 *
 * Above a composer the dock is "streaming, then ready, then gone": every
 * ordinary empty case — never drafted, expired, sent, superseded, held, a cycle
 * with no body yet, a state this build does not know — renders nothing at all,
 * because a permanent "no draft" band would be noise on every conversation in
 * the inbox and most conversations never had a draft.
 *
 * A FAILED READ is not one of those. A dead gateway (Rails 502), an
 * unconfigured one (503) and a transport failure are indistinguishable from "no
 * draft" if they render nothing, which is exactly the mistake the panel makes
 * when it renders a blank for a PII-denied Shopify field: a blank reads as
 * "there is nothing here" and sends an agent hunting a bug that does not exist.
 * So these three say why.
 *
 * Muted rather than red, and one line rather than the panel's two sentences: it
 * sits above the editor on every conversation for as long as the fault lasts, and
 * an alarm an agent sits beside all shift is tuned out within a day. `loading` is
 * not in here either — the first read resolves in a moment and a spinner
 * flickering above the editor on every conversation open is the noise this
 * placement exists to avoid.
 */
const NOTICE_KEYS = Object.freeze({
  [EMPTY_REASONS.UNAVAILABLE]: 'GOTCHU.DRAFT.NOTICE_UNAVAILABLE',
  [EMPTY_REASONS.UNCONFIGURED]: 'GOTCHU.DRAFT.NOTICE_UNCONFIGURED',
  [EMPTY_REASONS.FAILED]: 'GOTCHU.DRAFT.NOTICE_FAILED',
});

const noticeKey = computed(() => NOTICE_KEYS[view.value.emptyReason] ?? null);
</script>

<template>
  <!-- The notice and the dock can never both be on screen: every error view is
    `state: 'none'`, which the dock renders as nothing. They are siblings rather
    than an if/else so that each carries its own condition, and so a state added
    to one cannot silently hide the other. -->
  <p
    v-if="noticeKey"
    class="px-3 py-1.5 m-0 text-xs border-b text-[var(--g-text-muted)] border-[var(--g-border)]"
  >
    {{ $t(noticeKey) }}
  </p>
  <!-- Insert is the only gesture with a listener, and the only one the dock
    renders while the write surface is unavailable. The others are not "wired to
    nothing" — they are not on screen. -->
  <DraftDock
    :state="view.state"
    :text="view.text"
    :expires-at="view.expiresAt"
    :streaming-text="$t('GOTCHU.DRAFT.REDRAFTING')"
    :write-enabled="WRITE_SURFACE_AVAILABLE"
    @insert="onInsert"
  />
  <!-- The one write on this surface, and a sibling of the dock rather than a row
    inside it: what happens to the typed text depends on how a request this file
    makes turns out, and the dock is props-only by design — it clears its own
    field the moment it emits, which is exactly what must not happen to text a
    failed submission has to give back. The dock's own instruction row is part of
    the customer-facing set above and stays dark with it. -->
  <DraftInstruct
    v-if="canInstruct"
    v-model="instruction"
    :busy="submitting"
    :message="instructNotice ? $t(instructNotice.key) : null"
    :tone="instructNotice ? instructNotice.tone : 'info'"
    :max-length="MAX_INSTRUCTION_CHARS"
    @submit="onInstruct"
  />
</template>
