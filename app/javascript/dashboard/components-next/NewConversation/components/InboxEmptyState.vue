<script setup>
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
</script>

<template>
  <div class="flex items-center w-full px-4 py-3 bg-n-slate-3">
    <!-- The alert was amber on both themes. `n-slate-3` and `n-slate-12` each
      flip on their own, so the explicit dark: variants amber needed are gone. -->
    <span class="text-sm text-n-slate-12">
      {{ t('COMPOSE_NEW_CONVERSATION.FORM.NO_INBOX_ALERT') }}
    </span>
  </div>
</template>
