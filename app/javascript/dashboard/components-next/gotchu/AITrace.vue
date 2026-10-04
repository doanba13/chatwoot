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
});
// A kind this build does not know falls through to a check rather than dropping
// the step: a missing line reads as "Gotchu did not check that".
const STEP_ICONS = {
  order: 'i-lucide-search',
  fulfillment: 'i-lucide-truck',
  policy: 'i-lucide-book-open',
  dispute: 'i-lucide-shield',
  customer: 'i-lucide-users',
  procedure: 'i-lucide-list-checks',
  memo: 'i-lucide-bookmark',
  rule: 'i-lucide-sliders-horizontal',
  read: 'i-lucide-languages',
  thread: 'i-lucide-messages-square',
  tier: 'i-lucide-gauge',
};
const FALLBACK_ICON = 'i-lucide-check';

const { t } = useI18n();

const isOpen = ref(props.defaultOpen);

// Board 1: "How it got here · 7 steps".
const stepCount = computed(() =>
  t('GOTCHU.TRACE.STEPS', { count: props.steps.length }, props.steps.length)
);

const iconFor = step => STEP_ICONS[step.kind] ?? FALLBACK_ICON;

// `|| undefined` on the binding below, not `false`: Vue does not treat `inert`
// as a boolean attribute, so a false renders `inert="false"` — which is inert.
const isCollapsed = computed(() => !isOpen.value || Boolean(props.streaming));

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
        <span>
          <span class="font-semibold">
            {{ t('GOTCHU.TRACE.HOW_IT_GOT_HERE') }}
          </span>
          <span class="text-[var(--g-text-muted)]"> · {{ stepCount }}</span>
        </span>
        <!-- The chevron sits at the end of the row, not against the summary:
          the whole header is the hit area, so the affordance belongs at its
          edge rather than floating mid-row. -->
        <Icon
          icon="i-lucide-chevron-down"
          class="ml-auto size-3.5 transition-transform duration-[var(--g-dur-hover)]"
          :class="{ 'rotate-180': isOpen }"
        />
      </template>
    </button>
    <!-- The steps stay mounted so the shell can animate its own height: a
      `v-if` gives the browser nothing to transition from, and the thread below
      jumps by the height of the trace on every expand. Collapsed, the shell is
      zero-height and `inert`, so nothing inside it is focusable or read out. -->
    <div
      class="trace-reveal grid"
      :class="{ 'trace-reveal--open': !isCollapsed }"
      :inert="isCollapsed || undefined"
      :aria-hidden="isCollapsed ? 'true' : undefined"
    >
      <div class="overflow-hidden">
        <div class="flex flex-col gap-2 px-3 pt-1 pb-2.5">
          <div v-for="(step, index) in steps" :key="index" class="flex gap-2.5">
            <!-- A 20px box, the line height of `did`, so the icon is centred
              on the first line whatever its own optical centre is. A bare
              margin drifts per icon: lucide's truck and book sit differently
              inside their viewBox than the magnifier does. -->
            <span class="flex items-center flex-shrink-0 h-5">
              <Icon
                :icon="iconFor(step)"
                class="size-3.5 text-[var(--g-agent)]"
              />
            </span>
            <div class="flex flex-col gap-px min-w-0">
              <span class="text-sm text-[var(--g-agent)]">{{ step.did }}</span>
              <span
                v-if="step.result"
                class="text-xs text-[var(--g-text-muted)]"
              >
                {{ step.result }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Height and opacity rather than the `g-in` keyframe: `g-in` faded and slid the
   steps in over a container that had already snapped to its full height. */
.trace-reveal {
  grid-template-rows: 0fr;
  transition: grid-template-rows var(--g-dur-reveal) var(--g-ease-out);
}

.trace-reveal > * {
  opacity: 0;
  transition: opacity var(--g-dur-reveal) var(--g-ease-out);
}

.trace-reveal--open {
  grid-template-rows: 1fr;
}

.trace-reveal--open > * {
  opacity: 1;
}
</style>
