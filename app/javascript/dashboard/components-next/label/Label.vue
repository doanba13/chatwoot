<script setup>
import { computed } from 'vue';

const props = defineProps({
  label: {
    type: [Object, String],
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  color: {
    type: String,
    default: 'slate',
    validator: value =>
      [
        'slate',
        'amber',
        'teal',
        'ruby',
        'blue',
        'iris',
        'neutral',
        'agent',
        'agentFilled',
        'ink',
        'danger',
        'dashed',
        'attention',
      ].includes(value),
  },
});

// Each tone carries its own outline-style so `dashed` can differ; the width and
// offset stay on the base class.
const TONES = {
  neutral:
    'outline bg-[var(--g-slate-tint)] outline-[var(--g-border)] text-[var(--g-text)]',
  agent:
    'outline bg-transparent outline-[var(--g-agent-border)] text-[var(--g-agent)]',
  agentFilled:
    'outline bg-[var(--g-surface-tank)] outline-[var(--g-agent-border)] text-[var(--g-agent)]',
  ink: 'outline bg-[var(--g-ink)] outline-[var(--g-ink)] text-[var(--g-on-ink)]',
  danger:
    'outline bg-[var(--g-danger-tint)] outline-[var(--g-danger-border)] text-[var(--g-danger-text)]',
  slate:
    'outline bg-[var(--g-slate-tint-strong)] outline-transparent text-[var(--g-text-muted)]',
  dashed:
    'outline-dashed bg-transparent outline-[var(--g-border-strong)] text-[var(--g-text-muted)]',
  // `neutral` with the strong outline instead of the soft one. Exists because
  // retiring amber collapsed "needs attention soon" onto the same chip as an
  // ordinary label, and those two render side by side in one flex row on
  // ConversationCardExpanded — an SLA still due beside a conversation's own
  // labels. It spends no new hue, which is the constraint; the border weight
  // is the whole channel.
  attention:
    'outline bg-[var(--g-slate-tint)] outline-[var(--g-border-strong)] text-[var(--g-text)]',
};

// Chatwoot's existing colour prop values, mapped onto the tones above so the
// call sites passing them keep working. `slate` lands on `neutral` because that
// is what it already looked like — tint, border, full-strength text — and it is
// the default every uncoloured chip renders with. `amber` is retired: the
// palette has no warning hue, so a warning chip collapses onto `neutral` — ink
// text on a slate tint. It cannot take `ink`, which is the solid primary chip
// `blue` already maps to, and it cannot take `dashed`, which the design reserves
// for private notes. So an amber chip and a slate chip now look alike and the
// word inside carries the difference; that is the cost of retiring a role, not
// an oversight.
const COLOR_TONES = {
  slate: TONES.neutral,
  teal: TONES.agent,
  ruby: TONES.danger,
  blue: TONES.ink,
  iris: TONES.agentFilled,
  amber: TONES.neutral,
};

const TONE_CLASSES = { ...TONES, ...COLOR_TONES };

const isStringLabel = computed(() => typeof props.label === 'string');

const labelTitle = computed(() => {
  return isStringLabel.value ? props.label : props.label?.title;
});

const labelDescription = computed(() => {
  return (!isStringLabel.value && props.label?.description) || '';
});

const labelColor = computed(() => {
  return isStringLabel.value ? null : props.label.color;
});

// A user-chosen label colour shows as a swatch inside a neutral chip — the chip
// itself never takes the colour.
const colorClasses = computed(() =>
  labelColor.value ? TONES.neutral : TONE_CLASSES[props.color]
);
</script>

<template>
  <div
    :title="labelDescription"
    class="rounded-lg -outline-offset-1 outline-1 inline-flex items-center flex-shrink-0"
    :class="[
      colorClasses,
      compact ? 'px-1.5 h-6 gap-1 rounded-md' : 'px-2.5 h-8 gap-1.5 rounded-lg',
    ]"
  >
    <span
      v-if="labelColor"
      class="rounded-sm flex-shrink-0 size-2"
      :style="{ background: labelColor }"
    />
    <slot v-else name="icon" />
    <span
      class="whitespace-nowrap"
      :class="compact ? 'text-label-small' : 'text-label !font-420'"
    >
      {{ labelTitle }}
    </span>
    <slot name="action" />
  </div>
</template>
