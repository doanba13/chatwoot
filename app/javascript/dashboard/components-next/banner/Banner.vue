<script setup>
import { computed } from 'vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

const props = defineProps({
  color: {
    type: String,
    default: 'slate',
    validator: value =>
      ['blue', 'ruby', 'amber', 'slate', 'teal'].includes(value),
  },
  actionLabel: {
    type: String,
    default: null,
  },
  isLoading: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['action']);

// The design has three banner tones, so the five colour values collapse onto
// them the way Button's roles do: teal is the assistant, ruby is danger. Blue
// and amber have no equivalent in a six-colour palette — an informational or
// cautionary banner reads as neutral rather than as an alarm — so both land on
// slate rather than inventing a fourth tone.
const TONE_BY_COLOR = {
  slate: 'slate',
  blue: 'slate',
  amber: 'slate',
  teal: 'agent',
  ruby: 'danger',
};

const tone = computed(() => TONE_BY_COLOR[props.color] ?? 'slate');

const bannerClass = computed(() => {
  const classMap = {
    slate:
      'bg-[var(--g-slate-tint)] border-[var(--g-border)] text-[var(--g-text)] [&_.link]:text-[var(--g-text)]',
    agent:
      'bg-[var(--g-surface-tank)] border-[var(--g-agent-border)] text-[var(--g-text)] [&_.link]:text-[var(--g-text)]',
    danger:
      'bg-[var(--g-danger-tint)] border-[var(--g-danger-border)] text-[var(--g-danger-text)] [&_.link]:text-[var(--g-danger-text)]',
  };

  return classMap[tone.value];
});

// The action sits on a tinted ground, so it takes the surface as its own and
// carries the tone in its border and label — a faded fill would be the banner
// colour twice over and read as no button at all.
const buttonClass = computed(() => {
  const classMap = {
    slate: 'border-[var(--g-border)] text-[var(--g-text)]',
    agent: 'border-[var(--g-agent-border)] text-[var(--g-agent)]',
    danger: 'border-[var(--g-danger-border)] text-[var(--g-danger-text)]',
  };

  return classMap[tone.value];
});

const triggerAction = () => {
  if (props.isLoading) return;
  emit('action');
};
</script>

<template>
  <div
    class="text-sm rounded-[var(--g-radius-card)] flex items-center justify-between gap-2 border animate-[g-in_var(--g-dur-arrive)_var(--g-ease-out)]"
    :class="[
      bannerClass,
      {
        'py-2 px-3': !actionLabel,
        'pl-3 p-2': actionLabel,
      },
    ]"
  >
    <div :class="tone === 'agent' ? 'flex items-center gap-2' : ''">
      <span
        v-if="tone === 'agent'"
        class="flex-shrink-0 rounded-full size-1.5 bg-[var(--g-agent)]"
      />
      <slot />
    </div>
    <div class="flex-shrink-0">
      <button
        v-if="actionLabel"
        class="px-3 py-1 w-auto grid place-content-center border rounded-[var(--g-radius-control)] whitespace-nowrap bg-[var(--g-surface)] hover:brightness-[0.94]"
        :class="buttonClass"
        :disabled="isLoading"
        @click="triggerAction"
      >
        <Spinner v-if="isLoading" :size="16" />
        <span v-else>{{ actionLabel }}</span>
      </button>
    </div>
  </div>
</template>
