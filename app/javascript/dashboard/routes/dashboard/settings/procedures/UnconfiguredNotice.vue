<script setup>
import { useI18n } from 'vue-i18n';

// The three env vars the gateway needs, named here rather than only in the
// locale file, so the empty state and the message stay in step even if one
// of them is copy-edited on its own -- see GOTCHU_GATEWAY_URL et al. in
// Gotchu::ProcedureService.available?
const REQUIRED_ENV_VARS = [
  'GOTCHU_GATEWAY_URL',
  'GOTCHU_GATEWAY_SECRET',
  'GOTCHU_GESTURE_SECRET',
];

const { t } = useI18n();
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 py-20 text-center"
  >
    <span class="i-lucide-server-off size-10 text-n-slate-9" />
    <p class="max-w-md mb-0 text-n-slate-11 text-body-main">
      {{ t('PROCEDURES_MGMT.UNCONFIGURED.DESCRIPTION') }}
    </p>
    <code class="px-2 py-1 text-xs rounded bg-n-slate-3 text-n-slate-11">
      {{ REQUIRED_ENV_VARS.join(', ') }}
    </code>
  </div>
</template>
