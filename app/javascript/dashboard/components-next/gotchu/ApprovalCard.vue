<script setup>
import Button from 'dashboard/components-next/button/Button.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';
import ConfidenceChip from 'dashboard/components-next/gotchu/ConfidenceChip.vue';

// "Approve first" mode: the draft Gotchu wrote, the actions it intends to take,
// and three ways out — approve, adjust, hand over. One card per waiting case.
//
// Props only. There is no approval flow in this build: the reply loop's one
// human gesture lives in a Lark card (`apps/reply-worker`), the gateway's write
// routes are dark, and nothing enumerates "planned actions" anywhere. So this
// renders a shape the system cannot yet fill, deliberately, the same way
// `DraftDock`'s `streaming` state does.
defineProps({
  // Who wrote in. A name, not an id — the card is read, not queried.
  customer: {
    type: String,
    required: true,
  },
  // Rendered in the mono face beside the customer, because it is a string the
  // desk copies by hand. Null renders no separator either, rather than a
  // dangling middot.
  orderId: {
    type: String,
    default: null,
  },
  // The draft, as it would go out.
  text: {
    type: String,
    required: true,
  },
  // What approving would DO beyond sending the text: `{ icon, label }` each.
  // Empty renders no section at all — an empty "Planned actions" heading reads
  // as "the actions failed to load", which is a different and worse claim than
  // "this reply does nothing but reply".
  actions: {
    type: Array,
    default: () => [],
  },
  // DEPARTURE from the source, which defaults this to `'probably'`. Null, so no
  // chip renders, for exactly the reason `ConfidenceChip` refuses a default of
  // its own: `reply_draft.confidence` is written null on every row today, so a
  // default would put a measured-looking word on a card nothing measured. A
  // caller with no signal renders no chip.
  confidence: {
    type: String,
    default: null,
  },
});

defineEmits(['approve', 'adjust', 'handOver']);

// The source passes bare lucide names (`'check'`, `'truck'`). This fork's `Icon`
// takes the full unocss class, and `AITrace` already settled the vocabulary by
// mapping its own step kinds onto `i-lucide-*`. Accept both rather than make
// every caller restate the prefix, and fall through to a check — the same
// fallback and the same reasoning as AITrace's: a dropped row reads as "Gotchu
// is not going to do that".
const FALLBACK_ICON = 'i-lucide-check';

const iconFor = action => {
  if (!action.icon) return FALLBACK_ICON;
  return action.icon.startsWith('i-') ? action.icon : `i-lucide-${action.icon}`;
};
</script>

<template>
  <div
    class="approval-card overflow-hidden border rounded-[var(--g-radius-card)] border-[var(--g-agent-border)] bg-[var(--g-surface)]"
  >
    <!-- The header is the agent band: tank ground, agent text, the dot first, so
      it reads as the same voice as `DraftDock`'s header and `AITrace`'s summary
      row. -->
    <div
      class="flex items-center gap-2 px-3 py-2 text-sm font-medium border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)] text-[var(--g-agent)]"
    >
      <AgentDot />
      {{ $t('GOTCHU.APPROVAL.TITLE') }}
      <span class="ml-auto min-w-0 text-xs truncate text-[var(--g-text-muted)]">
        {{ customer }}
        <template v-if="orderId">
          ·
          <span class="font-[family-name:var(--g-font-mono)]">{{
            orderId
          }}</span>
        </template>
      </span>
    </div>
    <div class="flex flex-col gap-2.5 p-3 text-sm text-[var(--g-text)]">
      <!-- `text-pretty`, as `DraftDock`'s body has it: a draft ending in a
        one-word orphan line reads as truncated. No cap here, unlike the dock —
        this card is not wedged between a customer's message and a reply box. -->
      <div class="text-pretty">{{ text }}</div>
      <div
        v-if="actions.length"
        class="flex flex-col gap-1 text-xs text-[var(--g-text-muted)]"
      >
        <span class="font-medium text-[var(--g-text)]">
          {{ $t('GOTCHU.APPROVAL.PLANNED') }}
        </span>
        <span
          v-for="(action, index) in actions"
          :key="index"
          class="flex items-center gap-1.5"
        >
          <Icon
            :icon="iconFor(action)"
            class="flex-shrink-0 size-3 text-[var(--g-agent)]"
          />
          {{ action.label }}
        </span>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <!-- The one brand element. `Button`'s `color` enum is
          blue|ruby|amber|slate|teal and has no `brand`, so this is the fork's
          established way of spelling the source's `color: 'brand'`: a slate
          solid button overridden onto `n-axolotl`, copied from
          `ResolveAction.vue:206`, which is the only other brand button in the
          fork. `!` because these fight slate/solid's own utilities at equal
          specificity, and `!brightness-100` cancels the solid variant's hover
          filter — the design's hover is a named colour, `--g-brand-hover`.

          (1) was RESOLVED in the token layer, which is where it belonged:
          `--g-on-brand` is pinned to the ink literal in `.dark` so it no longer
          follows `--g-ink` to paper. The label now measures 5.88:1 in both
          themes, here and in ResolveAction. Keep this button spelled exactly as
          ResolveAction spells it so the two cannot drift apart again.

          (2) stands, and is deliberately not solved in code: "once per screen"
          cannot hold if this card renders inside a conversation whose header
          already shows Resolve — two axolotl buttons, one screen. The rule when
          that day comes is that RESOLVE yields, not Approve: the design puts
          brand on the handled moment, and an approval card is the more urgent
          claim on it. No machinery for that exists here because nothing mounts
          this card yet, and building a dynamic brand-budget before there is a
          second claimant would be speculative. Whoever wires it owns the
          switch. -->
        <Button
          color="slate"
          no-animation
          class="!bg-n-axolotl !text-n-on-axolotl !font-semibold !outline-transparent hover:enabled:!bg-n-axolotl-hover focus-visible:!bg-n-axolotl-hover hover:enabled:!brightness-100 focus-visible:!brightness-100"
          :label="$t('GOTCHU.APPROVAL.APPROVE')"
          @click="$emit('approve')"
        />
        <Button
          color="slate"
          variant="outline"
          :label="$t('GOTCHU.APPROVAL.ADJUST')"
          @click="$emit('adjust')"
        />
        <Button
          color="slate"
          variant="outline"
          :label="$t('GOTCHU.APPROVAL.HAND_OVER')"
          @click="$emit('handOver')"
        />
        <ConfidenceChip v-if="confidence" :level="confidence" class="ml-auto" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.approval-card {
  animation: g-in var(--g-dur-arrive) var(--g-ease-out);
}
</style>
