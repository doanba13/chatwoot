<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Button from 'dashboard/components-next/button/Button.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';
import AITrace from 'dashboard/components-next/gotchu/AITrace.vue';
import { BRAND_BUTTON_CLASS } from 'dashboard/components-next/gotchu/agent/brandButton';

// The draft card: streaming, then ready, then gone, with the mode switch and
// the mode's editor under it and, in Instruct, the footer. Exactly two paths out
// of a ready draft — insert it into the editor, or send it as it stands — plus
// Redraft, which reaches the agent and never the customer. A third path would
// be a second way to approve, and approval is the one gesture that has to stay
// countable.
//
// `streaming` is a design state this build can render but cannot yet produce:
// there is no push anywhere between the worker and a browser.
const props = defineProps({
  state: {
    type: String,
    default: 'none',
    validator: value => ['none', 'streaming', 'ready'].includes(value),
  },
  // What to say while the draft is still arriving.
  streamingText: {
    type: String,
    default: null,
  },
  text: {
    type: String,
    default: '',
  },
  // Set while `text` is a translation of the draft: says what the customer
  // actually receives. Display only; send and insert use the original.
  translationLabel: {
    type: String,
    default: null,
  },
  translationPartial: {
    type: Boolean,
    default: false,
  },
  // When the review window closes, as an ISO timestamp. Null renders nothing —
  // there is no window to default to.
  expiresAt: {
    type: String,
    default: null,
  },
  // Which composer mode is open. Only Instruct has this footer: Reply sends
  // through the composer's own panel and Memo has its own button.
  mode: {
    type: String,
    default: 'reply',
  },
  // Whether the server can forward an instruction. False hides Redraft; Insert
  // to edit and Send draft stay (spec §2.2).
  instructAvailable: {
    type: Boolean,
    default: false,
  },
  // The box is empty or a submission is in flight. The container knows; the
  // dock only draws it.
  redraftDisabled: {
    type: Boolean,
    default: false,
  },
  // Why Send draft cannot post a public reply here, already translated. Set
  // disables the button and says the reason beside it.
  sendBlockedReason: {
    type: String,
    default: null,
  },
  // Insert to edit and Send draft are locked: an instruction is being
  // submitted, or the draft on screen has just been sent.
  actionsLocked: {
    type: Boolean,
    default: false,
  },
  // What the agent looked at to write this draft, already worded as AITrace's
  // `{ kind, did, result }` steps. Empty renders no trace at all.
  trace: {
    type: Array,
    default: () => [],
  },
  // What the last instruction came to when that is a sentence rather than a new
  // draft: `{ kind: 'answered' | 'refused' | 'failed', text }`. Null says nothing.
  outcome: {
    type: Object,
    default: null,
  },
  // Where the draft on screen came from, beside the title ("v2 · from your
  // instruction"). Null renders nothing.
  versionLabel: {
    type: String,
    default: null,
  },
  // "Draft v1 · from Where is my order · tier: draft", worded by the
  // container from the trace. Null falls back to the plain title.
  heading: {
    type: String,
    default: null,
  },
  // The same heading, split so the procedure can be a link: `{ version,
  // procedure, procedureTo, tier }`. `procedureTo` is a route location, set only
  // when the trace row carries a procedure id (older rows do not), and the
  // procedure is plain text without it. Null falls back to `heading`.
  headingParts: {
    type: Object,
    default: null,
  },
  // What AITrace's summary row says after "How it got here": "7 steps · memo
  // used". Null leaves the plain step count.
  traceSummary: {
    type: String,
    default: null,
  },
  // Instructing is switched off on this desk. The Instruct footer is still
  // there (Insert to edit, Send draft); the box is not, and a resting line
  // says so.
  instructOff: {
    type: Boolean,
    default: false,
  },
  // An instruction of ours being redrafted: `{ instruction, steps, canStop }`,
  // each step `{ key, state: 'done' | 'now' | 'todo', text }`. Set, it draws
  // the working strip, dims the body (still readable, not removed) and locks
  // the footer. The steps are client timings; only the draft read ends them.
  working: {
    type: Object,
    default: null,
  },
  // A Stop is in flight: the button stays, disabled.
  stopping: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['insert', 'send', 'instruct', 'dismissOutcome', 'stop']);

// Insert and Send act on the draft on screen, so neither while it is still
// being written or rewritten (invariant 6: the dock reads `streaming` while an
// instruction is in flight).
const isReady = computed(() => props.state === 'ready');

// Streaming and ready share one header row — same height, same dot, same
// position — so becoming ready reveals a body under a header that has not
// moved, rather than swapping one band for a differently shaped one.
const isStreaming = computed(() => props.state === 'streaming');

// Insert to edit and Send draft act on the draft on screen, and while a redraft
// is being written that draft is about to change.
const locked = computed(() => props.actionsLocked || Boolean(props.working));

// The instruction as asked, in curly quotes: what the supporter typed, never
// the agent's words.
const quotedInstruction = computed(() =>
  props.working ? `“${props.working.instruction}”` : ''
);

const { t } = useI18n();

// How long is left to review, in words rather than a ticking clock. 47% of real
// draft cycles expire with nobody having looked at them, so the surface has to
// say that a window exists at all — but a digit-by-digit countdown reads as an
// alarm, and an alarm on a panel an agent sits beside all shift gets tuned out
// within a day. Minutes, then hours, muted, in the header the chip already uses.
//
// The dock gates nothing on this. Whether a window has really closed is the
// worker's call, not a browser's: a clock a minute fast must never be the reason
// Send draft stops working, and the dock cannot know what the cycle did.
const REVIEW_TICK_MS = 30 * 1000;

const now = ref(Date.now());
let ticker = null;

// Without a tick the label freezes at whatever it read when the conversation was
// opened, and this panel stays open for a shift. 30s is half of the granularity
// it renders, so the label is never more than half a unit stale.
onMounted(() => {
  ticker = setInterval(() => {
    now.value = Date.now();
  }, REVIEW_TICK_MS);
});

onBeforeUnmount(() => {
  clearInterval(ticker);
});

const reviewLabel = computed(() => {
  if (!props.expiresAt) return null;

  const expiry = Date.parse(props.expiresAt);
  // An unparseable timestamp renders nothing rather than `NaN min to review`.
  // The field arrives from a queue this build does not own.
  if (Number.isNaN(expiry)) return null;

  const minutes = Math.floor((expiry - now.value) / 60000);
  // Past the window, say so rather than counting upwards into a negative: the
  // number is not the point, the fact that reviewing it is now moot is.
  if (minutes < 0) return t('GOTCHU.DRAFT.REVIEW_EXPIRED');
  if (minutes < 1) return t('GOTCHU.DRAFT.REVIEW_SOON');
  if (minutes < 60) return t('GOTCHU.DRAFT.REVIEW_MINUTES', { count: minutes });
  return t('GOTCHU.DRAFT.REVIEW_HOURS', { count: Math.floor(minutes / 60) });
});
</script>

<template>
  <!-- What the last instruction came to, when it was not a new draft. Outside
    the band on purpose: an outcome often arrives when there is no draft to show
    — a refusal on a cycle already sent, an answer while a redraft is being
    written — and a line that only renders inside a ready band would be consumed
    with nobody seeing it. In the agent's voice, because it is the agent's
    answer; a failure is muted rather than red, like the read notices. -->
  <div
    v-if="outcome"
    class="draft-dock__outcome flex items-start gap-2 px-[18px] py-1.5 text-sm border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
    :class="
      outcome.kind === 'failed'
        ? 'text-[var(--g-text-muted)]'
        : 'text-[var(--g-agent)]'
    "
  >
    <span class="flex-1 min-w-0 text-pretty">{{ outcome.text }}</span>
    <button
      type="button"
      class="flex items-center p-0 bg-transparent border-0 cursor-pointer text-[var(--g-text-muted)] hover:text-[var(--g-text)]"
      :aria-label="$t('GOTCHU.DRAFT.DISMISS')"
      @click="$emit('dismissOutcome')"
    >
      <Icon icon="i-lucide-x" class="size-3.5" />
    </button>
  </div>
  <div
    v-if="state !== 'none'"
    class="draft-dock flex flex-col flex-1 min-h-0 gap-2 pb-0.5"
  >
    <!-- The redraft in progress, first in the card: what was asked, the three
      steps, and Stop. The draft below stays readable, dimmed. -->
    <div
      v-if="working"
      class="draft-dock__cook flex flex-col gap-1.5 p-2.5 mx-[18px] mt-3.5 rounded-lg bg-[var(--g-agent-soft)] border border-[var(--g-agent-border)]"
      role="status"
    >
      <div class="flex items-center gap-2">
        <span
          class="draft-dock__spinner size-3.5 flex-shrink-0 rounded-full border-2 border-[var(--g-agent)] border-t-transparent"
          aria-hidden="true"
        />
        <span class="flex-1 min-w-0 text-sm">
          <strong class="font-semibold text-[var(--g-text)]">
            {{ $t('GOTCHU.COMPOSER.WORKING_TITLE') }}
          </strong>
          <span class="text-[var(--g-text-muted)]">
            {{ ' ' }}{{ quotedInstruction }}
          </span>
        </span>
        <Button
          v-if="working.canStop"
          data-testid="composer-stop"
          color="slate"
          variant="ghost"
          size="sm"
          :label="$t('GOTCHU.COMPOSER.STOP')"
          :disabled="stopping"
          @click="$emit('stop')"
        />
      </div>
      <ol class="flex flex-col gap-0.5 m-0 ps-0 list-none text-xs">
        <li
          v-for="step in working.steps"
          :key="step.key"
          :data-step="step.key"
          :data-state="step.state"
          class="flex items-center gap-1.5"
          :class="{
            'text-[var(--g-text)] font-semibold': step.state === 'now',
            'text-[var(--g-text-muted)]': step.state !== 'now',
          }"
        >
          <span class="inline-flex w-3 flex-shrink-0" aria-hidden="true">
            <Icon
              v-if="step.state === 'done'"
              icon="i-lucide-check"
              class="size-3 text-[var(--g-agent)]"
            />
          </span>
          {{ step.text }}
        </li>
      </ol>
      <div
        class="draft-dock__bar relative h-[3px] overflow-hidden rounded-full bg-[var(--g-agent-border)]"
        aria-hidden="true"
      >
        <span
          class="draft-dock__bar-fill absolute inset-y-0 start-0 w-2/5 rounded-full bg-[var(--g-agent)]"
        />
      </div>
    </div>
    <!-- `.dh`: the pill, then the muted provenance line, then (at the right) the
      review window. Same row for streaming and ready, so nothing moves when the
      body arrives. -->
    <div
      class="draft-dock__header flex items-center justify-between gap-3 px-[18px] pt-3.5 pb-2"
    >
      <span class="flex flex-wrap items-center min-w-0 gap-x-2.5 gap-y-1">
        <span
          class="draft-dock__pill inline-flex items-center gap-1.5 px-2.5 py-0.5 text-sm font-semibold rounded-full bg-[var(--g-surface-tank)] text-[var(--g-agent)]"
        >
          <AgentDot :streaming="isStreaming" />
          <template v-if="isStreaming">{{ streamingText }}</template>
          <template v-else-if="headingParts">
            {{ $t('GOTCHU.DRAFT.PILL', { version: headingParts.version }) }}
          </template>
          <template v-else>{{ heading || $t('GOTCHU.DRAFT.TITLE') }}</template>
        </span>
        <span
          v-if="!isStreaming && versionLabel"
          class="text-xs font-normal text-[var(--g-text-muted)]"
        >
          {{ versionLabel }}
        </span>
        <!-- Said once for a screen reader and when the text is copied: the
          sentence the header always was, "Draft v1 · from … · tier: …". -->
        <span v-if="!isStreaming && headingParts" class="sr-only">
          {{ ' · ' }}
        </span>
        <span
          v-if="!isStreaming && headingParts"
          class="draft-dock__from text-xs text-[var(--g-text-muted)]"
        >
          <template v-if="headingParts.procedure">
            {{ $t('GOTCHU.DRAFT.PART_FROM') }}
            <router-link
              v-if="headingParts.procedureTo"
              :to="headingParts.procedureTo"
              class="underline text-[var(--g-text-muted)] hover:text-[var(--g-text)]"
            >
              {{ headingParts.procedure }}
            </router-link>
            <template v-else>{{ headingParts.procedure }}</template>
          </template>
          <template v-else>{{ $t('GOTCHU.DRAFT.PART_NO_PROCEDURE') }}</template>
          <template v-if="headingParts.tier">
            · {{ $t('GOTCHU.DRAFT.PART_TIER', { tier: headingParts.tier }) }}
          </template>
        </span>
      </span>
      <!-- One group, so the review window and the loader share the right-hand
        slot rather than each taking a third one in a `justify-between` row.
        Nothing in here is taller than the
        title beside it, so the shared header still does not move. -->
      <div class="flex items-center gap-2.5">
        <span v-if="reviewLabel" class="text-xs text-[var(--g-text-muted)]">
          {{ reviewLabel }}
        </span>
        <!-- Three bouncing dots, adapted from Chatwoot's own
          `components-next/copilot/CopilotLoader.vue` — MIT Expat, like
          everything outside `enterprise/` per the root LICENSE. Same shape and
          the same negative delays; repainted onto `--g-agent` instead of
          `n-iris`, timed off `--g-dur-pulse` (the token named for the streaming
          dot) instead of Tailwind's 1s `animate-bounce`, and sized to the 6px
          AgentDot beside the title rather than Copilot's 8px.

          It sits in the status slot at the right of the header rather than after
          the label, for two reasons. `streamingText` ends in an ellipsis
          ("Writing a new draft…") and has to keep doing so, so dots set
          immediately after it read as a stutter; and this is the slot the
          review window takes once the draft is ready. The leading dot and the
          title do not move, which is what the header comment above protects.

          What the dots claim is that work is happening, and only that. Nothing
          streams between the worker and a browser, which is why `streamingText`
          says a draft is being WRITTEN — so this is deliberately not a caret, a
          shimmer or a skeleton line in the place the text will land, all of
          which would say characters are arriving one at a time. -->
        <span
          v-if="isStreaming"
          class="draft-dock__loader inline-flex flex-shrink-0 items-center gap-1"
          aria-hidden="true"
        >
          <span
            class="draft-dock__dot w-1.5 h-1.5 rounded-full bg-[var(--g-agent)]"
          />
          <span
            class="draft-dock__dot w-1.5 h-1.5 rounded-full bg-[var(--g-agent)]"
          />
          <span
            class="draft-dock__dot w-1.5 h-1.5 rounded-full bg-[var(--g-agent)]"
          />
        </span>
      </div>
    </div>
    <!-- The body is mounted only once the draft is ready, rather than revealed
      from a collapsed shell. The footer's Insert to edit and Send draft stay
      disabled until then, so nothing is one Tab away from sending a reply
      nobody has read. -->
    <!-- Drawn whole. The card is what is capped (on `.reply-box`), and this
      region is the one thing inside it that gives way, down to a floor: the
      card's fixed parts take ~305px, so without `min-h-[148px]` a 768px-high
      screen left the draft 45px. Inside it the trace and the body share the
      height: an opened trace shrinks and scrolls on its own, never below its
      34px summary row (`min-h-[34px]`, or the closed row is cut in half), while
      the body keeps `min-h-[96px]`, about four lines, so opening the trace
      never pushes the draft out of view. The header above and the footer below
      are siblings, not children, so Send draft never scrolls out of view.
      `tabindex="0"` with `role="region"` is what makes the body's scroll
      reachable without a mouse. -->
    <div
      v-if="!isStreaming"
      class="draft-dock__scroll flex flex-col flex-1 min-h-[148px]"
    >
      <div
        v-if="trace.length"
        class="draft-dock__trace flex-shrink min-h-[34px] overflow-y-auto mx-[18px]"
      >
        <AITrace :steps="trace" :summary="traceSummary" tank />
      </div>
      <div
        class="draft-dock__body flex-1 min-h-[96px] overflow-y-auto px-[18px] py-4 text-[15px] leading-6 whitespace-pre-line text-pretty text-[var(--g-text)]"
        :class="{ 'is-dimmed': working }"
        role="region"
        tabindex="0"
        :aria-label="$t('GOTCHU.DRAFT.TITLE')"
      >
        <!-- Keyed by the text, so a redraft landing under the reader fades in
          as a new draft rather than swapping characters in place. -->
        <Transition name="draft-swap" mode="out-in">
          <span :key="text" class="block">{{ text }}</span>
        </Transition>
      </div>
      <p
        v-if="translationLabel"
        class="draft-dock__translation m-0 px-[18px] pb-2 text-xs text-[var(--g-text-muted)]"
      >
        {{ translationLabel }}
        <template v-if="translationPartial">
          · {{ $t('GOTCHU.TRANSLATE.PARTIAL') }}
        </template>
      </p>
    </div>
  </div>
  <!-- Below the draft body and above the footer, whether or not there is a
    draft: the mode switch must stay on screen when the band is gone, so these
    sit outside the band's own condition. The container fills them; the dock
    stays props-only. -->
  <div
    v-if="$slots.modes"
    class="draft-dock__modes px-[18px] py-2.5 border-t border-[var(--g-border)]"
  >
    <slot name="modes" />
  </div>
  <!-- Instructing is off on this desk: a resting line, not a failed
    submission, so nothing here says that anything was sent or not sent. -->
  <p
    v-if="mode === 'instruct' && state !== 'none' && instructOff"
    class="draft-dock__off mx-[18px] mt-2.5 mb-1 text-xs text-pretty text-[var(--g-text-muted)]"
  >
    {{ $t('GOTCHU.DRAFT.INSTRUCT_OFF') }}
  </p>
  <slot name="editor" />
  <!-- Instruct's footer: Redraft · Insert to edit · Send draft. Send draft is
    the one brand-coloured control on the screen (spec §2.3). -->
  <div
    v-if="mode === 'instruct' && state !== 'none'"
    class="draft-dock__footer flex flex-wrap items-center gap-2 px-[18px] pt-2.5 pb-3.5"
  >
    <Button
      v-if="instructAvailable"
      data-testid="composer-redraft"
      color="slate"
      variant="outline"
      size="sm"
      :label="$t('GOTCHU.COMPOSER.REDRAFT')"
      :disabled="!isReady || redraftDisabled"
      @click="$emit('instruct')"
    />
    <span class="flex-1" />
    <span
      v-if="sendBlockedReason"
      class="text-xs text-pretty text-[var(--g-text-muted)]"
    >
      {{ sendBlockedReason }}
    </span>
    <Button
      data-testid="composer-insert"
      color="slate"
      variant="outline"
      size="sm"
      :label="$t('GOTCHU.COMPOSER.INSERT_TO_EDIT')"
      :disabled="!isReady || locked"
      @click="$emit('insert')"
    />
    <Button
      data-testid="composer-send-draft"
      color="slate"
      size="sm"
      icon="i-lucide-send"
      :class="BRAND_BUTTON_CLASS"
      :label="$t('GOTCHU.DRAFT.SEND')"
      :title="sendBlockedReason || undefined"
      :disabled="!isReady || locked || !!sendBlockedReason"
      @click="$emit('send')"
    />
  </div>
</template>

<style scoped>
.draft-dock {
  animation: g-in var(--g-dur-arrive) var(--g-ease-out);
}

/* The capped body is focusable so it can be scrolled from the keyboard, and
   anything focusable has to show where the focus is. `focus-visible` rather than
   `focus`, so clicking into the draft text does not draw a ring around it. */
.draft-dock__body:focus-visible {
  outline: 2px solid var(--g-agent);
  outline-offset: 2px;
}

/* The draft the redraft was asked about: still there to read, plainly not
   the thing to act on. */
.draft-dock__body.is-dimmed {
  opacity: 0.4;
}

.draft-dock__spinner {
  animation: g-spin 0.8s linear infinite;
}

/* Indeterminate: a 40% fill sliding across, because the worker reports no
   progress to measure. */
@keyframes g-draft-indeterminate {
  0% {
    transform: translateX(-100%);
  }

  100% {
    transform: translateX(250%);
  }
}

.draft-dock__bar-fill {
  animation: g-draft-indeterminate 1.4s var(--g-ease-out) infinite;
}

/* The same tokens AITrace reveals its steps with, so the two read as one motion. */
.draft-swap-enter-active,
.draft-swap-leave-active {
  transition:
    opacity var(--g-dur-reveal) var(--g-ease-out),
    transform var(--g-dur-reveal) var(--g-ease-out);
}

.draft-swap-enter-from,
.draft-swap-leave-to {
  opacity: 0;
  transform: translateY(2px);
}

/* Adapted from Chatwoot's MIT-licensed CopilotLoader — see the template. The
   lift is an absolute 3px rather than Tailwind `animate-bounce`'s -25%, which on
   a 6px dot is 1.5px and invisible; the opacity travels with it so the wave
   reads at this size without the dots having to jump. The keyframes stay local
   rather than joining the token sheet's set: `g-in`, `g-pop`, `g-pulse` and
   `g-spin` come from the design project, and this one does not. */
@keyframes g-draft-bounce {
  0%,
  100% {
    opacity: 0.45;
    transform: translateY(0);
  }

  50% {
    opacity: 1;
    transform: translateY(-3px);
  }
}

.draft-dock__dot {
  animation: g-draft-bounce var(--g-dur-pulse) ease-in-out infinite;
}

/* Negative delays, which is Copilot's trick: every dot is already mid-cycle on
   the first frame, so the loader reads as running the moment it mounts instead
   of sitting flat for a third of a second. Proportional to the token rather than
   Copilot's literal -0.3s/-0.15s, so retiming `--g-dur-pulse` keeps the wave. */
.draft-dock__dot:first-child {
  animation-delay: calc(var(--g-dur-pulse) * -0.3);
}

.draft-dock__dot:nth-child(2) {
  animation-delay: calc(var(--g-dur-pulse) * -0.15);
}

/* An animation that bounces for a whole shift beside an agent is exactly what
   this query exists for. The token sheet's global block already flattens every
   animation to 0.01ms, but flattened means "stopped on whatever frame it landed
   on", so say what the still state is instead: three dots, dimmed, not moving.
   The label beside them carries the meaning either way — the dots were never the
   only signal that a draft is being written. */
@media (prefers-reduced-motion: reduce) {
  .draft-dock__bar-fill,
  .draft-dock__spinner {
    animation: none;
    transform: none;
  }

  .draft-dock__dot {
    opacity: 0.55;
    transform: none;
    animation: none;
  }
}
</style>
