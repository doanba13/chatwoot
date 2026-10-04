<script setup>
import { computed } from 'vue';

const props = defineProps({
  count: { type: [Number, String], default: 0 },
  // 'hot' is the canvas's attention count (pending memo proposals, Needs
  // you): ink, semibold, no pill.
  tone: { type: String, default: 'muted' },
});

const normalizedCount = computed(() => {
  const count = Number(props.count);
  return Number.isFinite(count) && count > 0 ? count : 0;
});

const displayCount = computed(() =>
  normalizedCount.value > 99 ? '99+' : String(normalizedCount.value)
);
</script>

<template>
  <span
    v-if="normalizedCount > 0 && tone === 'hot'"
    data-test-id="sidebar-unread-badge"
    class="flex-shrink-0 text-xs font-semibold text-[var(--g-text)]"
  >
    {{ displayCount }}
  </span>
  <span
    v-else-if="normalizedCount > 0"
    data-test-id="sidebar-unread-badge"
    class="inline-grid h-5 min-w-5 place-items-center rounded-full bg-n-slate-4 px-1 text-xxs font-medium leading-3 text-n-slate-12 dark:bg-n-slate-5 flex-shrink-0"
  >
    {{ displayCount }}
  </span>
  <span v-else class="hidden" />
</template>
