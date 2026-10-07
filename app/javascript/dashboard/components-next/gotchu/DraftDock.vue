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
});

defineEmits(['insert', 'send', 'instruct', 'dismissOutcome']);

// Insert and Send act on the draft on screen, so neither while it is still
// being written or rewritten (invariant 6: the dock reads `streaming` while an
// instruction is in flight).
const isReady = computed(() => props.state === 'ready');

// Streaming and ready share one header row — same height, same dot, same
// position — so becoming ready reveals a body under a header that has not
// moved, rather than swapping one band for a differently shaped one.
const isStreaming = computed(() => props.state === 'streaming');

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
    class="draft-dock__outcome flex items-start gap-2 px-3 py-1.5 text-sm border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
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
    class="draft-dock flex flex-col gap-2 px-3 py-2.5 border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
  >
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 text-sm font-medium text-[var(--g-agent)]"
      >
        <AgentDot :streaming="isStreaming" />
        {{ isStreaming ? streamingText : heading || $t('GOTCHU.DRAFT.TITLE') }}
        <span
          v-if="!isStreaming && versionLabel"
          class="text-xs font-normal text-[var(--g-text-muted)]"
        >
          {{ versionLabel }}
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
    <template v-if="!isStreaming">
      <AITrace v-if="trace.length" :steps="trace" />
      <!-- Capped, because an uncapped draft takes the screen the customer's
        message needs. Measured against real production drafts on staging in a
        1000px viewport: a 774-character draft rendered the dock at 329px and an
        815-character one at 349px, which left the reply box holding 68–70% of
        the window and the customer's own message — the thing being answered —
        clipped mid-sentence at 216–236px. Those are ordinary drafts; this agent
        writes 700–850 characters routinely.

        170px, and the odd number is the point. The body is `text-sm`, so its
        line box is 20px and 170px is eight and a HALF lines. A whole multiple
        (160, 180, 200) ends on a complete line and therefore reads as the end of
        the draft; half a line is unmistakably a draft that continues. That
        half-line is the whole affordance, and it is the native clip rather than
        an overlay — so unlike a gradient it cannot obscure the last line it
        exists to hint at. Backing the chrome out of the two measurements above
        (329 − 12×20 = 349 − 13×20 = 89px of header, buttons, padding and border)
        puts an 800-character draft at ~259px instead of ~349px, and hands those
        ~90px back to the thread.

        A ceiling, not a height: `max-height` alone and no `min-height`, so a
        two-line draft is two lines tall with no scrollbar and no reserved space.
        Only this element scrolls — the header above it and the footer below it
        are siblings, not children, because a Send draft that can scroll out of
        view is the failure a cap must not introduce. `tabindex="0"` with `role="region"`
        is what makes a scroll container reachable without a mouse; a capped div
        with neither is text a keyboard user cannot read to the end. -->
      <div
        class="draft-dock__body max-h-[170px] overflow-y-auto text-sm text-pretty text-[var(--g-text)]"
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
    </template>
  </div>
  <!-- Below the draft body and above the footer, whether or not there is a
    draft: the mode switch must stay on screen when the band is gone, so these
    sit outside the band's own condition. The container fills them; the dock
    stays props-only. -->
  <div
    v-if="$slots.modes"
    class="draft-dock__modes px-3 py-2.5 border-t border-[var(--g-border)]"
  >
    <slot name="modes" />
  </div>
  <slot name="editor" />
  <!-- Instruct's footer: Redraft · Insert to edit · Send draft. Send draft is
    the one brand-coloured control on the screen (spec §2.3). -->
  <div
    v-if="mode === 'instruct' && state !== 'none'"
    class="draft-dock__footer flex flex-wrap items-center gap-2 px-3 pt-2 pb-3"
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
      :disabled="!isReady || actionsLocked"
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
      :disabled="!isReady || actionsLocked || !!sendBlockedReason"
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
  .draft-dock__dot {
    opacity: 0.55;
    transform: none;
    animation: none;
  }
}
</style>
