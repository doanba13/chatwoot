<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { timelineSentence } from './threadWords';

const props = defineProps({
  item: { type: Object, required: true },
});

const { t } = useI18n();
const sentence = computed(() => timelineSentence(props.item, t));
</script>

<template>
  <li
    v-if="sentence"
    class="list-none text-center text-xs text-n-slate-11"
    data-thread-item="gotchu"
  >
    {{ sentence }}
  </li>
</template>
