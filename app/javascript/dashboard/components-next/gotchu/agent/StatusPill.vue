<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

const props = defineProps({
  status: { type: String, required: true },
  version: { type: Number, default: null },
});
const { t } = useI18n();
const DOT = {
  active: 'bg-[var(--g-agent)]',
  testing: 'bg-[var(--g-text-muted)]',
  archived: 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--g-border-strong)]',
};
const label = computed(() => {
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  const status = t(`GOTCHU_AGENT.STATUS.${props.status.toUpperCase()}`);
  return props.version == null
    ? status
    : t('GOTCHU_AGENT.STATUS_WITH_VERSION', { status, version: props.version });
});
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full bg-[var(--g-surface-tank)] text-[var(--g-text)]"
  >
    <span class="size-2 rounded-full" :class="DOT[status]" />
    {{ label }}
  </span>
</template>
