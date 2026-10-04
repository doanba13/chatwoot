<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <span
    class="inline-flex items-center px-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-[var(--g-text-muted)] border border-dashed border-[var(--g-border-strong)] rounded-[var(--g-radius-control)]"
  >
    {{ t('GOTCHU_AGENT.NOT_BUILT') }}
  </span>
</template>
