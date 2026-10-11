<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store.js';

// The desk answers asynchronously, so agent presence and working hours say
// nothing true about when a visitor hears back: "We are online" or "We are
// away at the moment" both imply someone is watching live. The card states the
// expected reply instead, whoever happens to be signed in. An unavailable
// message set on the inbox is the merchant's own words for exactly this case
// and still wins.
const { t } = useI18n();

const unavailableMessage = useMapGetter('appConfig/getUnavailableMessage');

const headerText = computed(
  () => unavailableMessage.value || t('TEAM_AVAILABILITY.ASYNC_TITLE')
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="font-medium text-n-slate-12">
      {{ headerText }}
    </div>
    <span class="text-n-slate-11">
      {{ t('TEAM_AVAILABILITY.ASYNC_REPLY') }}
    </span>
  </div>
</template>
