<script setup>
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import Icon from 'dashboard/components-next/icon/Icon.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';

// One line per step, verb first, past tense, result after a dash. Collapsed to
// a count by default and expanded inline — never a modal, because the trace
// exists to be glanced at while reading the thread, and a modal would cover the
// message it is explaining.
const props = defineProps({
  // Each step is `{ kind, did, result }`. `did` is what was done, `result` what
  // came back; `kind` only picks the icon.
  steps: {
    type: Array,
    default: () => [],
  },
  // When set, the trace is still being produced: the string is what to say
  // while it is. A streaming trace does not open — there is nothing to show
  // yet, and a header that toggles into an empty panel reads as broken.
  streaming: {
    type: String,
    default: null,
  },
  defaultOpen: {
    type: Boolean,
    default: false,
  },
  who: {
    type: String,
    default: 'Gotchu',
  },
});
// A kind this build does not know falls through to a check rather than dropping
// the step: a missing line reads as "Gotchu did not check that".
const STEP_ICONS = {
  order: 'i-lucide-search',
  fulfillment: 'i-lucide-truck',
  policy: 'i-lucide-book-open',
  dispute: 'i-lucide-shield',
  customer: 'i-lucide-users',
};
const FALLBACK_ICON = 'i-lucide-check';

const { t } = useI18n();

const isOpen = ref(props.defaultOpen);

const summary = computed(() =>
  t(
    'GOTCHU.TRACE.CHECKED',
    { name: props.who, count: props.steps.length },
    props.steps.length
  )
);

const iconFor = step => STEP_ICONS[step.kind] ?? FALLBACK_ICON;

const toggle = () => {
  if (props.streaming) return;
  isOpen.value = !isOpen.value;
};
</script>

<template>
  <!-- The caller places this: in the thread it sits on the agent side, in the
    gallery it does not. Alignment is not the component's to decide. -->
  <div
    class="overflow-hidden border rounded-[var(--g-radius-card)] border-[var(--g-agent-border)] bg-[var(--g-surface)]"
  >
    <button
      type="button"
      class="flex items-center w-full gap-2 px-2.5 py-1.5 text-sm text-left bg-transparent border-0 text-[var(--g-agent)]"
      :class="streaming ? 'cursor-default' : 'cursor-pointer'"
      :aria-expanded="streaming ? undefined : isOpen"
      @click="toggle"
    >
      <AgentDot :streaming="!!streaming" />
      <span v-if="streaming">{{ streaming }}</span>
      <template v-else>
        <span>{{ summary }}</span>
        <Icon
          icon="i-lucide-chevron-down"
          class="size-3.5 transition-transform duration-[var(--g-dur-hover)]"
          :class="{ 'rotate-180': isOpen }"
        />
      </template>
    </button>
    <div
      v-if="isOpen && !streaming"
      class="trace-steps flex flex-col gap-2 px-3 pt-1 pb-2.5"
    >
      <div v-for="(step, index) in steps" :key="index" class="flex gap-2.5">
        <Icon
          :icon="iconFor(step)"
          class="mt-0.5 size-3.5 flex-shrink-0 text-[var(--g-agent)]"
        />
        <div class="flex flex-col gap-px min-w-0">
          <span class="text-sm text-[var(--g-agent)]">{{ step.did }}</span>
          <span v-if="step.result" class="text-xs text-[var(--g-text-muted)]">
            {{ step.result }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.trace-steps {
  animation: g-in var(--g-dur-reveal) var(--g-ease-out);
}
</style>
