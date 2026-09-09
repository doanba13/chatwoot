<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// Three plain words, never a percentage. A number invites an agent to treat
// 0.71 and 0.68 as different when the model cannot tell them apart, and it
// invites a threshold nobody agreed to. The list is inline because a
// `defineProps` validator cannot reference a module-scope constant.
//
// `level` is deliberately required and has no default. Today
// `reply_draft.confidence` is written null on every draft, so a default would
// render `probably` about a draft nothing measured. A caller with no signal
// renders no chip.
const props = defineProps({
  level: {
    type: String,
    required: true,
    validator: value => ['sure', 'probably', 'check'].includes(value),
  },
  // Optional tooltip: what the level was read from, in the caller's words.
  title: {
    type: String,
    default: null,
  },
});

const { t } = useI18n();

const label = computed(() =>
  t(`GOTCHU.CONFIDENCE.${props.level.toUpperCase()}`)
);
</script>

<template>
  <span
    :title="title"
    class="inline-flex items-center h-5 px-2 whitespace-nowrap border rounded-[var(--g-radius-control)] border-[var(--g-agent-border)] text-[var(--g-agent)] text-xs font-medium"
  >
    {{ label }}
  </span>
</template>
