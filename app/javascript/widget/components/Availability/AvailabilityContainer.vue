<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter } from 'dashboard/composables/store.js';
import { useAvailability } from 'widget/composables/useAvailability';

// The desk answers asynchronously, so agent presence says nothing true about
// when a visitor hears back: "We are online" or "We are away at the moment"
// both imply someone is watching live. The card states the expected reply
// instead. The one exception is the merchant's own out-of-office text (the
// inbox's unavailable message), shown only while the inbox's working hours
// are enabled and it is currently outside them, as the stock widget did.
const { t } = useI18n();

const unavailableMessage = useMapGetter('appConfig/getUnavailableMessage');
const { inboxConfig, isInWorkingHours } = useAvailability();

const isOutOfOffice = computed(
  () =>
    !!unavailableMessage.value &&
    inboxConfig.value.workingHoursEnabled &&
    !isInWorkingHours.value
);
</script>

<template>
  <div class="flex flex-col gap-1">
    <div class="font-medium text-n-slate-12">
      {{
        isOutOfOffice ? unavailableMessage : t('TEAM_AVAILABILITY.ASYNC_TITLE')
      }}
    </div>
    <!-- Not the inbox's reply_time: production inboxes say "a few minutes", which is false for this desk. -->
    <span v-if="!isOutOfOffice" class="text-n-slate-11">
      {{ t('TEAM_AVAILABILITY.ASYNC_REPLY') }}
    </span>
  </div>
</template>
