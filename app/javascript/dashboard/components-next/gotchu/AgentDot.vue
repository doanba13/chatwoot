<script setup>
// The spine ships two dots — `AgentDot` and `StreamingDot` — whose markup is
// identical but for the pulse. One component with a prop rather than two files
// that would drift apart.
//
// The animation lives in CSS, not motion-v: it is a state loop, and the token
// sheet's `prefers-reduced-motion` block already flattens it.
defineProps({
  streaming: {
    type: Boolean,
    default: false,
  },
  size: {
    type: Number,
    default: 6,
  },
});
</script>

<template>
  <span
    class="inline-block flex-shrink-0 rounded-full bg-[var(--g-agent)]"
    :class="{ 'agent-dot--streaming': streaming }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.agent-dot--streaming {
  animation: g-pulse var(--g-dur-pulse) ease-in-out infinite;
}
</style>
