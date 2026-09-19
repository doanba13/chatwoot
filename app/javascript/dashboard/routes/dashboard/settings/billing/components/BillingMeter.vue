<script setup>
import { computed } from 'vue';
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  consumed: {
    type: Number,
    required: true,
  },
  totalCount: {
    type: Number,
    required: true,
  },
});

const percent = computed(() =>
  Math.round((props.consumed / props.totalCount) * 100)
);

const colorClass = computed(() => {
  if (percent.value < 50) {
    return 'bg-n-teal-10';
  }
  // The middle rung of the meter was amber. Ink, not a mid slate: the bar has to
  // read against the slate track it sits in, and it is the only rung between
  // healthy teal and over-budget ruby.
  if (percent.value < 80) {
    return 'bg-n-slate-12';
  }
  return 'bg-n-ruby-10';
});
</script>

<template>
  <div
    class="flex gap-5 items-center justify-between text-xs uppercase text-n-slate-10"
  >
    <div class="font-medium tracking-wider">
      {{ title }}
    </div>
    <div class="tabular-nums">{{ consumed }} / {{ totalCount }}</div>
  </div>
  <div class="rounded-full overflow-hidden h-2 w-full bg-n-slate-4 mt-2">
    <div class="h-2" :class="colorClass" :style="{ width: `${percent}%` }" />
  </div>
</template>
