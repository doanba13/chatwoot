<script setup>
import { h, isVNode } from 'vue';

const props = defineProps({
  icon: { type: [String, Object, Function], required: true },
});

const renderIcon = () => {
  if (!props.icon) return null;
  // A function is a component to render, never a child to print: returned
  // as-is it reaches the DOM as its own source text.
  if (typeof props.icon === 'function') return h(props.icon);
  if (isVNode(props.icon)) return props.icon;
  return h('span', { class: props.icon });
};
</script>

<template>
  <component :is="renderIcon" />
</template>
