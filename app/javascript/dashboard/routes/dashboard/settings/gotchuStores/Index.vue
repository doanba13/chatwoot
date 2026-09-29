<script setup>
import { onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { storeRoutesErrorKey } from './errors';

import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import InboxMapping from './InboxMapping.vue';

// The page shell: SettingsLayout, the header, and the loading/empty states
// shared by every section this route mounts. It owns the one GET this
// screen needs and passes the result down -- InboxMapping.vue is a
// presentational section that reports back via `@updated` rather than
// fetching for itself, so a later `<ShopifyStores />` (sub-item 4) can share
// the same read instead of each section polling the gateway on its own.
const { t } = useI18n();

const isLoading = ref(true);
// Optimistic until the first read answers -- only a read that actually came
// back false should draw the unconfigured empty state (the procedures
// screen's own Index.vue takes the same posture for its own capability).
const available = ref(true);
const stores = ref([]);
const inboxes = ref([]);

const applyData = data => {
  stores.value = data.stores || [];
  inboxes.value = data.inboxes || [];
};

const fetchRoutes = async () => {
  isLoading.value = true;
  try {
    const { data } = await StoreRoutesAPI.get();
    available.value = data.capabilities?.store_routes === true;
    applyData(data);
  } catch (error) {
    useAlert(t(storeRoutesErrorKey(error)));
  } finally {
    isLoading.value = false;
  }
};

onBeforeMount(fetchRoutes);
</script>

<template>
  <SettingsLayout
    :is-loading="isLoading"
    :loading-message="t('GOTCHU_STORES.LOADING')"
  >
    <template #header>
      <BaseSettingsHeader
        :title="t('GOTCHU_STORES.HEADER')"
        :description="t('GOTCHU_STORES.DESCRIPTION')"
      />
    </template>
    <template #body>
      <p v-if="!available" class="py-20 text-center text-n-slate-11">
        {{ t('GOTCHU_STORES.UNCONFIGURED') }}
      </p>
      <p v-else-if="!stores.length" class="py-20 text-center text-n-slate-11">
        {{ t('GOTCHU_STORES.NO_STORES') }}
      </p>
      <InboxMapping
        v-else
        :stores="stores"
        :inboxes="inboxes"
        @updated="applyData"
      />
    </template>
  </SettingsLayout>
</template>
