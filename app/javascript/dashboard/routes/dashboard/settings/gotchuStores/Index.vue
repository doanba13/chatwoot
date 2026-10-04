<script setup>
import { onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { storeRoutesReadErrorKey } from './errors';

import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import InboxMapping from './InboxMapping.vue';
import ShopifyStores from './ShopifyStores.vue';

// The page shell: SettingsLayout, the header, and the loading/empty states
// shared by every section this route mounts. It owns the one GET this
// screen needs and passes the result down -- InboxMapping.vue is a
// presentational section that reports back via `@updated` rather than
// fetching for itself. `<ShopifyStores @connected="onConnected" />` (sub-item 4) reads its own
// endpoint instead: it is a different gateway route with its own
// availability, and it is mounted ABOVE and OUTSIDE the v-if chain below so a
// merchant with no store yet -- the one who needs its Connect form -- still
// sees it.
const { t } = useI18n();

const isLoading = ref(true);
// Optimistic until the first read answers -- only a read that actually came
// back false should draw the unconfigured empty state (the procedures
// screen's own Index.vue takes the same posture for its own capability).
const available = ref(true);
const stores = ref([]);
const inboxes = ref([]);
// The i18n key of why the read failed, or null. A failed read is its own
// state (final code review I1): left as it was, `available` stayed true and
// `stores` empty, so the page told an admin with working stores to go and
// connect one -- and toasted about a "change" a read never made.
const loadFailedKey = ref(null);

const applyData = data => {
  stores.value = data.stores || [];
  inboxes.value = data.inboxes || [];
};

// `silent` re-reads without the loading state: SettingsLayout renders the body
// behind a v-else, so toggling isLoading would remount ShopifyStores in the
// middle of finishing an install.
const fetchRoutes = async ({ silent = false } = {}) => {
  if (!silent) isLoading.value = true;
  loadFailedKey.value = null;
  try {
    const { data } = await StoreRoutesAPI.get();
    available.value = data.capabilities?.store_routes === true;
    applyData(data);
  } catch (error) {
    loadFailedKey.value = storeRoutesReadErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

// A store was just connected: the mapping section below must see it without a
// reload.
const onConnected = () => fetchRoutes({ silent: true });

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
      >
        <!-- Board 4: the page heading is the Agent pages' display h1. -->
        <template #title>
          <h1
            class="m-0 [font:var(--g-text-display)] tracking-[var(--g-tracking-display)] text-[var(--g-text)]"
            data-testid="stores-heading"
          >
            {{ t('GOTCHU_STORES.HEADER') }}
          </h1>
        </template>
      </BaseSettingsHeader>
    </template>
    <template #body>
      <ShopifyStores @connected="onConnected" />
      <div v-if="loadFailedKey" class="py-20 text-center">
        <p class="mb-1 text-base font-medium text-n-slate-12">
          {{ t('GOTCHU_STORES.LOAD_FAILED.TITLE') }}
        </p>
        <p class="text-n-slate-11">{{ t(loadFailedKey) }}</p>
      </div>
      <p v-else-if="!available" class="py-20 text-center text-n-slate-11">
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
