<script setup>
import { useAttrs } from 'vue';
import { useMapGetter } from 'dashboard/composables/store';

const attrs = useAttrs();
const globalConfig = useMapGetter('globalConfig/get');
</script>

<template>
  <img
    v-if="globalConfig.logoThumbnail"
    v-bind="attrs"
    :src="globalConfig.logoThumbnail"
  />
  <svg
    v-else
    v-once
    v-bind="attrs"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="8" fill="#ff6b8b" />
    <g
      transform="translate(5 5) scale(0.5833)"
      stroke="#14213d"
      stroke-width="2.5"
      stroke-linecap="round"
    >
      <path d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7" />
      <circle cx="12" cy="12" r="2" />
    </g>
  </svg>
</template>
