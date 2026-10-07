<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { wordStep } from './traceWords';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import AiDraftAPI from 'dashboard/api/gotchu/aiDraft';
import { setDraftMeta } from './helpers/draftMeta';
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
  // The composer's Instruct tab (agent-screens plan decision 10): the
  // instruction state stays here, and this only says whether its field is
  // open. ReplyBox passes false on the Reply and Memo tabs.
  instructMode: {
    type: Boolean,
    default: true,
  },
  // Whether the reply editor is on screen. On the Instruct and Memo tabs it
  // is not, so Insert first asks for the Reply tab and inserts once it is
  // there: an insert fired at an unmounted editor reaches no listener, and
  // the stamp would mark the next reply, typed from scratch, as an edit of
  // this draft.
  replyMounted: {
    type: Boolean,
    default: true,
  },
  // Why Send draft cannot post a public reply here, already translated, or
  // null. ReplyBox decides it from `canSendPublicReply`; the dock draws it.
  sendBlockedReason: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['draftState', 'wantsReply', 'sendDraft']);

// Send draft goes out through the composer's own stamped send, never a gateway
// send route (plan Decision 1, 2026-10-06 conversation-screen plan).

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

/**
 * The cadence while an instruction is in flight, and the point at which the dock
 * stops waiting for it.
 *
 * Faster than the resting poll because a supporter who just pressed the arrow IS
 * watching, and an answer that lands 14 seconds after the worker wrote it reads
 * as the instruction having hung. Only for as long as something is in flight.
 *
 * The backstop exists because "working" can be a lie told by silence: a job that
 * died in the worker never reports anything. Past it the dock says it could not
 * finish and hands the typed text back, rather than spinning for a shift.
 */
const FAST_POLL_INTERVAL_MS = 2 * 1000;
const INSTRUCTION_BACKSTOP_MS = 180 * 1000;

const { t, te } = useI18n();

const view = ref(loadingView());

// The instruction whose outcome the dock is waiting for: its request id, the
// conversation it was typed in, when, and the text (handed back on a failure).
// Null when nothing is in flight.
//
// `expired: true` once the backstop has fired. The dock has stopped waiting —
// the failed line is up, the field is back, the poll is at its resting pace —
// but the request id is kept and still asked about, because the backstop is a
// client guess, not a second source of truth (spec §3.2): a late outcome still
// renders on the next poll and replaces the failed line.
const inFlight = ref(null);
// Actively waiting: in flight and not yet past the backstop. This, not
// `inFlight`, is what puts the dock in its working state and the poll on 2 s.
const waiting = computed(() =>
  Boolean(inFlight.value && !inFlight.value.expired)
);
// What the last instruction came to, when that is a sentence rather than a new
// draft: `{ kind: 'answered' | 'refused' | 'failed', text }`, or null.
const outcome = ref(null);
// The draft a redraft landed as, `{ cycleId, version }`, or null. Kept as the
// draft's identity rather than as a sentence, because the label is only true of
// that draft: a customer writing again (a new cycle) or a later redraft puts a
// draft on screen the instruction never touched, and "v2 · from your
// instruction" above it would tell the supporter their change is in it.
const redraftedTo = ref(null);
// Whole seconds since the instruction in flight was accepted, for the working
// line. Ticked by its own interval, which runs only while something is in flight.
const workingSeconds = ref(0);
let workingTicker = null;

/**
 * The version number behind whatever `view.text` currently shows, or null.
 *
 * Not part of `view` — the dock renders none of it — but Insert and the
 * staleness check in `read()` both need the exact number the gateway just
 * returned, to name on a send and to notice when it has moved on.
 */
const draftVersion = ref(null);

/**
 * The draft Send draft last emitted, `{ cycleId, version }`, or null. The dock
 * stays `ready` at the same version until a read says the cycle moved on, and
 * the composer's send does not dedupe, so without this a second press inside
 * that window posts the draft to the customer twice.
 */
const sent = ref(null);
const sentShown = computed(
  () =>
    sent.value !== null &&
    view.value.state === 'ready' &&
    sent.value.cycleId === view.value.cycleId &&
    sent.value.version === draftVersion.value
);

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

/**
 * Turn the read's report on the instruction in flight into what the dock says.
 *
 * Only for the conversation the instruction was typed in; a read for any other
 * one has nothing to say about it. Still working leaves everything as it is
 * until the backstop; any other report ends the wait. A redraft says nothing
 * beyond its version label: the new draft on screen IS the outcome.
 *
 * Only for the instruction the read ASKED about, too. A read started for an
 * earlier instruction — one past its backstop, still asked about at the resting
 * pace — can finish after the supporter submitted a new one, and its answer is
 * about the old instruction: applied here it would tell them what their new
 * instruction did, from a different one, and stop waiting for the real answer.
 */
const settle = (status, readFor, requestId) => {
  const flight = inFlight.value;
  if (!flight || flight.conversationId !== readFor) return;
  if (flight.requestId !== requestId) return;
  if (!status || status.state === 'working') {
    // Already given up on once: keep asking, quietly, at the resting pace.
    if (flight.expired) return;
    if (Date.now() - flight.startedAt <= INSTRUCTION_BACKSTOP_MS) return;
    outcome.value = { kind: 'failed', text: t('GOTCHU.DRAFT.OUTCOME_FAILED') };
    if (instruction.value === '') instruction.value = flight.text;
    // Stop waiting but keep the request id: see `inFlight`.
    inFlight.value = { ...flight, expired: true };
    return;
  }
  if (status.state === 'redrafted') {
    // The new draft on screen is the outcome; a failed line the backstop put up
    // is no longer true.
    outcome.value = null;
    redraftedTo.value = {
      cycleId: view.value.cycleId,
      version: status.version,
    };
  } else if (status.state === 'answered') {
    outcome.value = { kind: 'answered', text: status.answer };
  } else if (status.state === 'refused') {
    // Any code this build has no sentence for says the generic one: the state
    // machine's reasons are not a closed list from here.
    const key = `GOTCHU.DRAFT.REFUSED.${(status.reasonCode ?? '').toUpperCase()}`;
    outcome.value = {
      kind: 'refused',
      text: te(key) ? t(key) : t('GOTCHU.DRAFT.REFUSED.GENERIC'),
    };
  } else {
    outcome.value = { kind: 'failed', text: t('GOTCHU.DRAFT.OUTCOME_FAILED') };
  }
  // Spec §3.2: a failure gives the typed text back, so nobody retypes it.
  if (outcome.value?.kind === 'failed' && instruction.value === '') {
    instruction.value = flight.text;
  }
  // A terminal answer, early or late. Dropping `inFlight` is also what puts the
  // poll back on the resting cadence: the watcher on it restarts the timer.
  inFlight.value = null;
};

// Which conversation a read is in flight for, and which instruction it asks
// about, or null. A gateway slower than the
// interval would otherwise stack ticks up behind each other, which is the shape
// of load that turns a slow dependency into a dead one.
//
// Keyed by conversation rather than a bare boolean, and that is not tidiness: a
// boolean here meant that switching conversations DURING a slow read skipped the
// new read altogether, and since the old read's answer is then discarded as
// stale, the dock sat on its loading state until the next tick. The one moment
// the guard fired was the one moment it must not.
//
// The request id is part of the key for the same reason. A resting read still
// asking about an expired instruction must not swallow the immediate read a NEW
// submission makes: that read is the one asking about the instruction the dock
// is now waiting on.
let readingFor = null;
let timer = null;

const read = async () => {
  // The conversation this read is asked for. An agent clicking down a list
  // switches conversations faster than a round trip completes, and an answer for
  // the previous customer painted above the next one's editor is the worst thing
  // this surface can do — worse than showing nothing, because it is confidently
  // wrong, nothing about it looks stale, and Insert is one press away.
  const readFor = props.conversationId;

  // The request id travels only with reads for the conversation it was typed in.
  // A read for any other conversation asking about it would be asking the
  // gateway about an instruction on a different cycle.
  const requestId =
    inFlight.value?.conversationId === readFor
      ? inFlight.value.requestId
      : undefined;

  const readKey = `${readFor}:${requestId ?? ''}`;
  if (readingFor === readKey) return;
  readingFor = readKey;

  try {
    const { data } = await AiDraftAPI.getDraft(readFor, { requestId });
    if (readFor !== props.conversationId) return;
    view.value = draftViewFrom(data);
    setDraftMeta(readFor, {
      lang: view.value.lang,
      channel: view.value.channel,
      threadRoutes: view.value.threadRoutes,
    });
    draftVersion.value =
      Number.isInteger(data?.draft?.version) && data.draft.version > 0
        ? data.draft.version
        : null;
    // Server config, read every time rather than cached: an operator who sets the
    // credential and restarts Rails gets the field within a poll, and one who
    // takes it away loses it just as fast.
    instructAvailable.value = data?.capabilities?.instruct === true;
    // A different cycle, version or a state that is not ready: the sent draft
    // is no longer the one on screen, so Send draft is free again.
    if (sent.value && !sentShown.value) sent.value = null;

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
    settle(data?.instruction, readFor, requestId);
  } catch (error) {
    if (readFor !== props.conversationId) return;
    instructAvailable.value = false;
    // 503 is an unconfigured gateway and 502 is a dead one: an operator has to
    // do something about the first and nobody has to do anything about the
    // second. errorView keeps those apart; the notice below says which.
    view.value = errorView(error?.response?.status);
    // No status to report, but the backstop still runs: a gateway that stays
    // down must not leave the dock saying "working" for the rest of the shift.
    settle(null, readFor, requestId);
  } finally {
    // Only if this is still the read in flight. A stale read finishing after the
    // agent moved on must not clear the new conversation's slot and let a tick
    // fire a second concurrent read for it.
    if (readingFor === readKey) readingFor = null;
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
  timer = window.setInterval(
    tick,
    waiting.value ? FAST_POLL_INTERVAL_MS : POLL_INTERVAL_MS
  );
};

const stopWorkingTicker = () => {
  if (!workingTicker) return;
  window.clearInterval(workingTicker);
  workingTicker = null;
};

// Starting or ending a wait changes the poll's cadence, and only while it is
// polling at all — an unmounted dock must not start a timer again.
watch(inFlight, flight => {
  if (timer) startPolling();
  stopWorkingTicker();
  workingSeconds.value = 0;
  if (!flight || flight.expired) return;
  workingTicker = window.setInterval(() => {
    workingSeconds.value = Math.floor((Date.now() - flight.startedAt) / 1000);
  }, 1000);
});

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
  sent.value = null;
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
  // An instruction in flight was typed against the previous customer's draft.
  // Its outcome belongs there, and asking about it from here would put its
  // request id on this conversation's reads. Cleared BEFORE the poll restarts,
  // so the cadence drops back to the resting one as well.
  inFlight.value = null;
  outcome.value = null;
  redraftedTo.value = null;
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
  stopWorkingTicker();
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

const onInsert = async () => {
  // One snapshot, text and version together, taken before the await below: a
  // poll landing during it must not pair this text with a newer version.
  const { text, cycleId } = view.value;
  const version = draftVersion.value;
  if (!text || waiting.value || submitting.value || sentShown.value) return;

  if (!props.replyMounted) {
    emit('wantsReply');
    await nextTick();
  }

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
  if (Number.isInteger(cycleId) && Number.isInteger(version)) {
    rememberInsertedDraft(props.conversationId, {
      cycleId,
      draftVersion: version,
    });
  }
};

/**
 * Send the draft on screen, as it stands, stamped with the version shown.
 *
 * One snapshot: text, cycle and version are read together, so a redraft
 * landing between render and press can never send v2's text stamped v1
 * (invariant 6). The local is `version`, not `draftVersion`: that name would
 * shadow the ref inside its own initialiser and throw on every press. It never
 * reads `instruction` — typed text has no path to a customer (invariant 5).
 */
const onSendDraft = () => {
  const { text, cycleId, state } = view.value;
  const version = draftVersion.value;
  if (!text || state !== 'ready') return;
  if (!Number.isInteger(cycleId) || !Number.isInteger(version)) return;
  if (waiting.value || submitting.value || props.sendBlockedReason) return;
  if (sentShown.value) return;
  emit('sendDraft', { text, stamp: { cycleId, draftVersion: version } });
  sent.value = { cycleId, version };
  // Learn at once that the cycle moved on, rather than up to 15 s later.
  read();
};

/**
 * Whether there is anything to instruct ABOUT.
 *
 * A draft that is ready, a cycle id to name it by, and a deployment that can
 * forward the gesture. Not while one is being written: the field is about the
 * draft on screen, and there is none. Nor while an instruction is in flight:
 * the next one would be about a draft that is about to change under it.
 */
const canInstruct = computed(
  () =>
    instructAvailable.value &&
    !waiting.value &&
    view.value.state === 'ready' &&
    view.value.cycleId !== null
);

// Redraft presses only with something to send and nothing in flight.
const redraftDisabled = computed(
  () => submitting.value || !canInstruct.value || !instruction.value.trim()
);

/**
 * Forward what the supporter typed, then wait for what it came to.
 *
 * What the POST answers is acceptance, not an outcome. The outcome comes from
 * the draft read, which reports on the instruction by its request id — a new
 * version, an answer, a refusal or a failure — so an accepted instruction puts
 * the dock into its working state and polls fast until the read says how it
 * turned out (see `settle`). An immediate read is safe now: whatever state the
 * cycle is in, the dock is saying "working" rather than "nothing changed".
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
    // one — but this one is now the instruction in flight, so the token moves
    // there before it is dropped. The field is cleared here and nowhere else.
    inFlight.value = {
      requestId: pendingRequestId,
      conversationId: submitFor,
      startedAt: Date.now(),
      text,
    };
    outcome.value = null;
    redraftedTo.value = null;
    pendingRequestId = null;
    pendingText = null;
    instruction.value = '';
    instructNotice.value = null;
    startPolling();
    read();
  } catch (error) {
    if (submitFor !== props.conversationId) return;
    // The typed text stays exactly where it is, and so does the token: pressing
    // again is a retry of this submission, not a second instruction.
    const key =
      INSTRUCT_ERROR_KEYS[error?.response?.data?.reason] ??
      INSTRUCT_ERROR_KEYS.unavailable;
    instructNotice.value = { key, tone: 'error' };
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

// Shown only while the draft on screen is the one the redraft landed as.
const versionLabel = computed(() => {
  const to = redraftedTo.value;
  if (!to || to.version == null) return null;
  if (to.cycleId !== view.value.cycleId || to.version !== draftVersion.value) {
    return null;
  }
  return t('GOTCHU.DRAFT.FROM_INSTRUCTION', { version: to.version });
});

// Whether a draft is on screen to act on, for the composer: ReplyBox offers
// Instruct and words the Reply hint from it. It does not depend on
// `instructAvailable` (plan Decision 7): where instructing is switched off the
// draft is still there to read, insert or send, and ReplyBox shows the
// Instruct mode only while the box can take one. An instruction in flight keeps
// it, so the mode does not move mid-redraft. Display only; nothing reads it to
// send.
const hasDraft = computed(
  () => waiting.value || ['ready', 'streaming'].includes(view.value.state)
);
watch(hasDraft, value => emit('draftState', { hasDraft: value }), {
  immediate: true,
});

// The sentence for each step lives in traceWords.js, in one place.
const traceSteps = computed(() =>
  (view.value.trace ?? []).map(step => wordStep(step, t, te)).filter(Boolean)
);

const TIERS = ['off', 'hand_over', 'draft', 'auto'];
// The tier the header names: the cycle's own row (`cycle.tier`), which the
// release requires to read `auto` before it approves, so it is the one word
// that cannot say "draft" while a release is scheduled. The trace records the
// binding as drafted; a Stop or a refused release since then lowers the row,
// not the trace. A row with no tier lets nothing release, so a traced `auto`
// reads as a draft there. A gateway from before the field (`undefined`)
// leaves the trace's word as it is, which can only over-say `auto`.
// The conversation's `gotchu_tier` attribute is never read here: it is a
// best-effort mirror that a failed write, an attribute merge or any token
// can lose, and lowering on its absence told supporters to reply by hand
// while a release was scheduled.
const headerTier = (traced, row) => {
  if (row === undefined) return traced;
  if (row !== null) return row;
  return traced === 'auto' ? 'draft' : traced;
};

// "Draft v1 · from Where is my order · tier: draft". It names the tier and
// nothing more: it never says the draft is sending (spec §8.4).
const dockHeading = computed(() => {
  const version = draftVersion.value;
  if (version == null) return null;
  const trace = view.value.trace ?? [];
  const procedure = trace.find(step => step?.kind === 'procedure');
  const tier = trace.find(step => step?.kind === 'tier');
  const noMatch = tier && tier.tier == null && tier.channel != null;
  if (!procedure || noMatch) {
    return t('GOTCHU.DRAFT.HEADER_NO_PROCEDURE', { version });
  }
  const shown = tier ? headerTier(tier.tier, view.value.cycleTier) : null;
  if (!tier || (tier.channel != null && !TIERS.includes(shown))) {
    return t('GOTCHU.DRAFT.HEADER_NO_TIER', {
      version,
      procedure: procedure.title,
    });
  }
  const tierWord =
    tier.channel == null
      ? t('GOTCHU.TRACE.CHANNEL_UNKNOWN')
      : // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
        t(`GOTCHU.TRACE.TIERS.${shown.toUpperCase()}`);
  return t('GOTCHU.DRAFT.HEADER', {
    version,
    procedure: procedure.title,
    tier: tierWord,
  });
});

// While an instruction is in flight the dock says so, whatever the cycle is
// doing underneath: the worker may not have picked the job up yet, and a ready
// draft shown as ready reads as the press having done nothing.
const dockState = computed(() =>
  waiting.value ? 'streaming' : view.value.state
);
const dockStreamingText = computed(() =>
  waiting.value
    ? t('GOTCHU.DRAFT.WORKING', { seconds: workingSeconds.value })
    : t('GOTCHU.DRAFT.REDRAFTING')
);
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
  <DraftDock
    :state="dockState"
    :text="view.text"
    :expires-at="view.expiresAt"
    :streaming-text="dockStreamingText"
    :trace="traceSteps"
    :outcome="outcome"
    :version-label="versionLabel"
    :heading="dockHeading"
    :mode="instructMode ? 'instruct' : 'reply'"
    :instruct-available="instructAvailable"
    :redraft-disabled="redraftDisabled"
    :send-blocked-reason="sendBlockedReason"
    :actions-locked="submitting || sentShown"
    @insert="onInsert"
    @send="onSendDraft"
    @instruct="onInstruct"
    @dismiss-outcome="outcome = null"
  >
    <template v-if="$slots.modes" #modes><slot name="modes" /></template>
    <!-- In Instruct the editor slot is this file's own box, because what
      happens to the typed text depends on how a request this file makes turns
      out. Elsewhere it is the parent's. -->
    <template v-if="instructMode || $slots.editor" #editor>
      <template v-if="instructMode">
        <DraftInstruct
          v-if="instructAvailable && hasDraft"
          v-model="instruction"
          :busy="submitting || !canInstruct"
          :message="instructNotice ? $t(instructNotice.key) : null"
          :tone="instructNotice ? instructNotice.tone : 'info'"
          :max-length="MAX_INSTRUCTION_CHARS"
          autofocus
          @submit="onInstruct"
        />
        <!-- Instructing is off here, and Instruct is still offered for its
          footer (plan Decision 7): say why there is no box. -->
        <p
          v-else-if="hasDraft"
          class="mx-3 mt-2.5 mb-1 text-xs text-pretty text-[var(--g-text-muted)]"
        >
          {{ $t('GOTCHU.DRAFT.INSTRUCT_UNCONFIGURED') }}
        </p>
      </template>
      <slot v-else name="editor" />
    </template>
  </DraftDock>
</template>
