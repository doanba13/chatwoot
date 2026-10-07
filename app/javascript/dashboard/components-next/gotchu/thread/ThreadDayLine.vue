<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { dayLabel } from './threadWords';

const props = defineProps({
  date: { type: Date, required: true },
});

const { t, locale } = useI18n();
const label = computed(() => dayLabel(props.date, new Date(), t, locale.value));
</script>

<template>
  <li
    class="list-none text-center text-xs font-semibold tracking-[.04em] uppercase text-n-slate-11"
    data-thread-item="day"
  >
    {{ label }}
  </li>
</template>
