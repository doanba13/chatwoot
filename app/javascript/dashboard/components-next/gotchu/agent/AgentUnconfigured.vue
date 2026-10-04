<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>

<template>
  <div
    class="px-4 py-3 text-sm border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)] text-[var(--g-text-muted)]"
    data-testid="agent-unconfigured"
  >
    {{ t('GOTCHU_AGENT.ERRORS.UNCONFIGURED') }}
  </div>
</template>
