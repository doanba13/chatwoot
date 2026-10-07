<script setup>
// The composer card, in miniature: board 1's `.dock`. The real one is
// `.reply-box` in ReplyBox.vue, which needs Vuex, the inbox store, the editor
// and a conversation, so this stands in for it with the same frame — teal edge,
// 16px radius, the design's one elevation — and the same cap, so a draft that
// outgrows it can be seen scrolling its own body. Whatever DraftDock draws goes
// in the default slot; the card has no rows of its own.
defineProps({
  // The card's ceiling, standing in for `min(70vh, 100%)` of the thread column.
  maxHeight: { type: String, default: null },
});
</script>

<template>
  <div
    class="composer-card flex flex-col w-full max-w-[760px] border rounded-[16px] border-[var(--g-agent-border)] bg-[var(--g-surface)] shadow-[var(--g-shadow-pop)]"
    :style="maxHeight ? { maxHeight } : undefined"
  >
    <slot />
  </div>
</template>
