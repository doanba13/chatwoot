<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { storeRoutesErrorKey } from './errors';
import {
  SHARED,
  MAX_SHOP_EMAILS,
  initialAssignment,
  initialShopEmails,
  unlistedInboxes,
  needsSharedWarning,
  buildStorePayload,
} from './mapping';

import Button from 'dashboard/components-next/button/Button.vue';
import Select from 'dashboard/components-next/select/Select.vue';
import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import Dialog from 'dashboard/components-next/dialog/Dialog.vue';

// The mapping form itself: one row per inbox, a store picker with a shared
// option, shop addresses per store, and this section's OWN Save button --
// deliberately not in the page header's `#actions` (preflight.md A8), so a
// later `<ShopifyStores />` mounted above this component in Index.vue does
// not inherit a button that means "save the inbox mapping".
const props = defineProps({
  stores: { type: Array, required: true },
  inboxes: { type: Array, required: true },
});

const emit = defineEmits(['updated']);

const { t } = useI18n();

const CHANNEL_LABEL_KEYS = {
  email: 'GOTCHU_STORES.CHANNEL.EMAIL',
  messenger: 'GOTCHU_STORES.CHANNEL.MESSENGER',
  web: 'GOTCHU_STORES.CHANNEL.WEB',
};

const isSaving = ref(false);
const assignment = ref({});
const shopEmails = ref({});
// Mapped-but-unlisted inbox ids the admin has explicitly chosen to drop on
// the next save. Everything else mapped to a store stays mapped by
// default -- see mapping.js#buildStorePayload, the one place this is read.
const removedIds = ref(new Set());
const sharedWarning = ref(null);
const pending = ref(null);
// Bumped when a picked value is rolled back, so the Select re-renders from
// assignment rather than keeping the option the admin clicked.
const renderTick = ref(0);

// Re-seed the editable state whenever the server truth changes: the initial
// load, and again after a save this component itself just emitted back up
// through Index.vue. Never mid-edit -- the parent only replaces these props
// on a fresh read, so this never overwrites an admin's uncommitted changes.
watch(
  () => [props.stores, props.inboxes],
  () => {
    assignment.value = initialAssignment(props.stores, props.inboxes);
    shopEmails.value = initialShopEmails(props.stores);
    removedIds.value = new Set();
  },
  { immediate: true }
);

const unlisted = computed(() => unlistedInboxes(props.stores, props.inboxes));

const storeOptions = computed(() => [
  { value: SHARED, label: t('GOTCHU_STORES.SHARED') },
  ...props.stores.map(store => ({ value: store.key, label: store.name })),
]);

const storeName = key =>
  props.stores.find(store => store.key === key)?.name || key;

// Board 4's grouping, over the same `assignment` state the per-inbox picker
// always edited: each store card lists the inboxes assigned to it, and the
// shared card the ones assigned to no single store. Moving an inbox, or
// connecting one from a store card, goes through `pick`, so the shared-
// mailbox warning and its rollback are unchanged.
const inboxesOf = storeKey =>
  props.inboxes.filter(inbox => assignment.value[inbox.id] === storeKey);
const sharedInboxes = computed(() =>
  props.inboxes.filter(
    inbox => (assignment.value[inbox.id] ?? SHARED) === SHARED
  )
);
const sharedEmailInboxes = computed(() =>
  sharedInboxes.value.filter(inbox => inbox.channel === 'email')
);
const connectOptions = computed(() =>
  sharedInboxes.value
    .filter(inbox => inbox.channel)
    .map(inbox => ({ value: inbox.id, label: `${inbox.name} #${inbox.id}` }))
);
const storeDot = index => `var(--g-store-${(index % 5) + 1})`;

const channelLabel = channel =>
  channel
    ? t(CHANNEL_LABEL_KEYS[channel])
    : t('GOTCHU_STORES.CHANNEL.UNSUPPORTED');

const assign = (inboxId, storeKey) => {
  assignment.value = { ...assignment.value, [inboxId]: storeKey };
};

const pick = (inbox, storeKey) => {
  if (
    needsSharedWarning({
      storeCount: props.stores.length,
      channel: inbox.channel,
      storeKey,
    })
  ) {
    pending.value = { inboxId: inbox.id, storeKey };
    sharedWarning.value?.open();
    return;
  }
  assign(inbox.id, storeKey);
};

const confirmPending = () => {
  if (pending.value) assign(pending.value.inboxId, pending.value.storeKey);
  pending.value = null;
  sharedWarning.value?.close();
};

const cancelPending = () => {
  if (!pending.value) return;
  pending.value = null;
  renderTick.value += 1;
};

// Bumped after a connect, so the picker returns to its placeholder.
const connectTick = ref(0);
const connect = (storeKey, inboxId) => {
  const inbox = props.inboxes.find(i => i.id === Number(inboxId));
  if (inbox) pick(inbox, storeKey);
  connectTick.value += 1;
};
const setShopEmails = (storeKey, emails) => {
  shopEmails.value = { ...shopEmails.value, [storeKey]: emails };
};

const markForRemoval = id => {
  removedIds.value = new Set(removedIds.value).add(id);
};

const keepMapped = id => {
  const next = new Set(removedIds.value);
  next.delete(id);
  removedIds.value = next;
};

const save = async () => {
  isSaving.value = true;
  try {
    const payload = buildStorePayload({
      stores: props.stores,
      inboxes: props.inboxes,
      assignment: assignment.value,
      shopEmails: shopEmails.value,
      unlisted: unlisted.value,
      removedIds: removedIds.value,
    });
    const { data } = await StoreRoutesAPI.replace(payload, [
      ...removedIds.value,
    ]);
    emit('updated', data);
    useAlert(t('GOTCHU_STORES.SAVED'));
  } catch (error) {
    if (error?.response?.data?.reason === 'unlisted_inbox_dropped') {
      // Defensive only: the notice below always sends an explicit decision
      // (kept or acknowledged) for every unlisted inbox this component
      // loaded with, so this fires only when the mapping changed underneath
      // the admin -- another admin's own save landing between this load and
      // this one -- and named an id this load never showed.
      const ids = (error.response.data.inboxIds || []).join(', ');
      useAlert(t('GOTCHU_STORES.ERRORS.UNLISTED_INBOX_DROPPED', { ids }));
    } else {
      useAlert(t(storeRoutesErrorKey(error)));
    }
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="flex flex-col gap-10">
    <section v-if="unlisted.length" class="p-4 border rounded-xl border-n-weak">
      <h3 class="mb-1 text-base font-medium text-n-slate-12">
        {{ t('GOTCHU_STORES.UNLISTED.TITLE') }}
      </h3>
      <p class="mb-4 text-sm text-n-slate-11">
        {{ t('GOTCHU_STORES.UNLISTED.DESCRIPTION') }}
      </p>
      <ul class="flex flex-col gap-2">
        <li
          v-for="item in unlisted"
          :key="item.id"
          class="flex items-center justify-between gap-4 p-3 rounded-lg bg-n-slate-2"
        >
          <div class="flex flex-col">
            <span class="text-sm text-n-slate-12">
              {{
                t('GOTCHU_STORES.UNLISTED.ITEM', {
                  id: item.id,
                  channel: channelLabel(item.channel),
                  store: storeName(item.storeKey),
                })
              }}
            </span>
            <span v-if="removedIds.has(item.id)" class="text-sm text-n-ruby-9">
              {{
                t('GOTCHU_STORES.UNLISTED.PENDING_REMOVAL', {
                  store: storeName(item.storeKey),
                })
              }}
            </span>
          </div>
          <Button
            v-if="removedIds.has(item.id)"
            :label="t('GOTCHU_STORES.UNLISTED.UNDO')"
            slate
            faded
            sm
            @click="keepMapped(item.id)"
          />
          <Button
            v-else
            :label="t('GOTCHU_STORES.UNLISTED.REMOVE')"
            ruby
            faded
            sm
            @click="markForRemoval(item.id)"
          />
        </li>
      </ul>
    </section>

    <!-- The shared mailbox: which shop address files a forwarded mail under
      which store. Every store's addresses, as before. -->
    <section
      class="p-5 border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
      data-testid="stores-shared-mail"
    >
      <h3 class="mb-1 text-base font-medium text-n-slate-12">
        {{
          sharedEmailInboxes.length
            ? sharedEmailInboxes.map(inbox => inbox.name).join(', ')
            : t('GOTCHU_STORES.SHOP_EMAILS.TITLE')
        }}
      </h3>
      <p class="mb-4 text-sm text-n-slate-11">
        {{ t('GOTCHU_STORES.SHOP_EMAILS.DESCRIPTION') }}
      </p>
      <div
        v-for="store in stores"
        :key="store.key"
        class="grid gap-2 py-3 border-t md:grid-cols-[minmax(0,1fr)_200px] md:items-start border-[var(--g-border)]"
      >
        <div class="px-3 py-2 border rounded-xl border-n-weak">
          <TagInput
            :model-value="shopEmails[store.key] || []"
            type="email"
            :placeholder="t('GOTCHU_STORES.SHOP_EMAILS.PLACEHOLDER')"
            :disabled="(shopEmails[store.key] || []).length >= MAX_SHOP_EMAILS"
            allow-create
            @update:model-value="emails => setShopEmails(store.key, emails)"
          />
        </div>
        <span class="text-sm font-medium text-n-slate-12 md:pt-2">
          {{ t('GOTCHU_STORES.SHOP_EMAILS.TO_STORE', { store: store.name }) }}
        </span>
      </div>
      <p class="mt-2 mb-0 text-sm text-n-slate-10">
        {{ t('GOTCHU_STORES.SHOP_EMAILS.LIMIT') }}
        {{ t('GOTCHU_STORES.SHOP_EMAILS.FALLBACK') }}
      </p>
    </section>

    <!-- One card per store: its inboxes, the shared mail it reaches through,
      and a picker to connect another inbox. -->
    <section
      v-for="(store, index) in stores"
      :key="store.key"
      class="p-5 border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
      :data-testid="`store-card-${store.key}`"
    >
      <h3
        class="flex items-center gap-2 mb-3 text-base font-medium text-n-slate-12"
      >
        <span
          class="inline-block rounded-full size-2"
          :style="{ background: storeDot(index) }"
        />
        {{ store.name }}
        <span
          class="text-xs font-normal [font-family:var(--g-font-mono)] text-n-slate-10"
        >
          {{ store.key }}
        </span>
      </h3>
      <ul class="flex flex-col gap-2 p-0 m-0 list-none">
        <li
          v-for="inbox in inboxesOf(store.key)"
          :key="inbox.id"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <span class="flex items-center gap-2 text-sm text-n-slate-12">
            {{ inbox.name }}
            <span
              class="inline-flex items-center h-6 px-2 rounded-md text-label-small bg-n-slate-3 text-n-slate-11"
            >
              {{ channelLabel(inbox.channel) }}
            </span>
            <span
              class="text-xs [font-family:var(--g-font-mono)] text-n-slate-10"
            >
              #{{ inbox.id }}
            </span>
          </span>
          <Select
            :key="`${inbox.id}-${renderTick}`"
            :model-value="assignment[inbox.id]"
            :options="storeOptions"
            :disabled="!inbox.channel"
            @update:model-value="value => pick(inbox, value)"
          />
        </li>
        <li
          v-for="inbox in sharedEmailInboxes"
          :key="`shared-${inbox.id}`"
          class="flex items-center gap-2 text-sm text-n-slate-11"
        >
          {{ t('GOTCHU_STORES.EMAIL_VIA_SHARED', { name: inbox.name }) }}
          <span
            class="text-xs [font-family:var(--g-font-mono)] text-n-slate-10"
          >
            #{{ inbox.id }}
          </span>
        </li>
      </ul>
      <div v-if="connectOptions.length" class="mt-3">
        <Select
          :key="`connect-${store.key}-${connectTick}`"
          model-value=""
          :options="connectOptions"
          :placeholder="t('GOTCHU_STORES.CONNECT_INBOX')"
          :aria-label="t('GOTCHU_STORES.CONNECT_INBOX')"
          @update:model-value="value => connect(store.key, value)"
        />
      </div>
    </section>

    <!-- Every inbox in no single store, with the same picker, so each one is
      still reachable here. -->
    <section
      class="p-5 border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
      data-testid="stores-unassigned"
    >
      <h3 class="mb-3 text-base font-medium text-n-slate-12">
        {{ t('GOTCHU_STORES.SHARED') }}
      </h3>
      <p v-if="!inboxes.length" class="mb-0 text-sm text-n-slate-11">
        {{ t('GOTCHU_STORES.INBOXES.EMPTY') }}
      </p>
      <ul class="flex flex-col gap-2 p-0 m-0 list-none">
        <li
          v-for="inbox in sharedInboxes"
          :key="inbox.id"
          class="flex flex-wrap items-center justify-between gap-3"
        >
          <span class="flex items-center gap-2 text-sm text-n-slate-12">
            {{ inbox.name }}
            <span
              class="inline-flex items-center h-6 px-2 rounded-md text-label-small bg-n-slate-3 text-n-slate-11"
            >
              {{ channelLabel(inbox.channel) }}
            </span>
            <span
              class="text-xs [font-family:var(--g-font-mono)] text-n-slate-10"
            >
              #{{ inbox.id }}
            </span>
          </span>
          <div class="flex flex-col items-end gap-1">
            <Select
              :key="`${inbox.id}-${renderTick}`"
              :model-value="assignment[inbox.id]"
              :options="storeOptions"
              :disabled="!inbox.channel"
              @update:model-value="value => pick(inbox, value)"
            />
            <span v-if="!inbox.channel" class="text-sm text-n-slate-10">
              {{ t('GOTCHU_STORES.INBOXES.UNSUPPORTED') }}
            </span>
          </div>
        </li>
      </ul>
    </section>

    <section class="flex justify-end">
      <Button
        :label="t('GOTCHU_STORES.SAVE')"
        size="sm"
        :is-loading="isSaving"
        :disabled="isSaving"
        @click="save"
      />
    </section>

    <Dialog
      ref="sharedWarning"
      type="alert"
      :title="t('GOTCHU_STORES.SHARED_WARNING.TITLE')"
      :description="t('GOTCHU_STORES.SHARED_WARNING.DESCRIPTION')"
      :confirm-button-label="t('GOTCHU_STORES.SHARED_WARNING.CONFIRM')"
      :cancel-button-label="t('GOTCHU_STORES.SHARED_WARNING.CANCEL')"
      @confirm="confirmPending"
      @close="cancelPending"
    />
  </div>
</template>
