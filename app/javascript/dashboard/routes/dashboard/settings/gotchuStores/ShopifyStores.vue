<script setup>
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

import GotchuShopifyAPI from 'dashboard/api/gotchu/shopify';
import { shopifyError } from './shopifyErrors';

import Button from 'dashboard/components-next/button/Button.vue';

const emit = defineEmits(['connected']);
// The "Connect a Shopify store" section (item 6.4). It sits above the inbox
// mapping in Index.vue, outside its v-if chain, so a merchant with no store
// yet -- exactly who needs the button -- still sees it.
//
// Shopify's return does not complete anything by itself: the gateway's public
// callback only forwards the browser here with `shopify_return=1` and Shopify's
// own query, and THIS page finishes the install through the signed-in proxy
// (decision 20). That is what ties an install to the administrator's session
// rather than to whoever holds a link.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
// False until the first read says otherwise, so a dark app never flashes a
// form it cannot use.
const available = ref(false);
const stores = ref([]);
const shop = ref('');
const connecting = ref(false);
const completing = ref(false);
const prefixDraft = ref({});
const connectedKey = ref('');
const needsPrefixReview = ref(false);

const STATUS_KEYS = {
  active: 'GOTCHU_SHOPIFY.STATUS.ACTIVE',
  disconnected: 'GOTCHU_SHOPIFY.STATUS.DISCONNECTED',
};

// The only off-site navigation on this screen. The Rails proxy already
// refuses a non-Shopify URL; this is the second check, not the first.
const SHOPIFY_AUTHORIZE =
  /^https:\/\/[a-z0-9][a-z0-9-]*\.myshopify\.com\/admin\/oauth\/authorize\?/;

const alertFor = error => {
  const { key, params } = shopifyError(error);
  useAlert(t(key, params));
};

const load = async () => {
  try {
    const { data } = await GotchuShopifyAPI.stores();
    available.value = data.capabilities?.shopify_app === true;
    stores.value = data.stores || [];
    prefixDraft.value = Object.fromEntries(
      stores.value.map(s => [s.key, s.orderPrefix])
    );
  } catch (error) {
    alertFor(error);
  }
};

// Shopify's callback query as one string, without the fork's own marker
// (`shopify_return` is not in Shopify's signed set; sending it would fail the
// HMAC check). Null when this page load is not Shopify's return.
const returnQuery = () => {
  if (!('shopify_return' in route.query)) return null;
  const params = new URLSearchParams();
  Object.entries(route.query).forEach(([name, value]) => {
    if (name === 'shopify_return') return;
    [].concat(value).forEach(v => params.append(name, v ?? ''));
  });
  return params.toString();
};

// The callback query carries a one-time code and state. It leaves the router's
// current route (and with it history.state, so a remount or a navigation
// spreading the current route cannot bring it back and complete twice) and
// the address bar before anything else happens.
const dropQueryFromAddressBar = () => router.replace({ query: {} });

const completeInstall = async query => {
  completing.value = true;
  try {
    const { data } = await GotchuShopifyAPI.complete(query);
    connectedKey.value = data.storeKey;
    needsPrefixReview.value = data.prefixNeedsReview === true;
    emit('connected', data.storeKey);
    await load();
  } catch (error) {
    alertFor(error);
  } finally {
    completing.value = false;
  }
};

const connect = async domain => {
  connecting.value = true;
  try {
    const { data } = await GotchuShopifyAPI.install(domain ?? shop.value);
    if (!SHOPIFY_AUTHORIZE.test(data.authorizeUrl || '')) {
      throw new Error('unexpected authorize URL');
    }
    window.location.assign(data.authorizeUrl);
  } catch (error) {
    alertFor(error);
    connecting.value = false;
  }
};

const savePrefix = async key => {
  try {
    const { data } = await GotchuShopifyAPI.updatePrefix(
      key,
      prefixDraft.value[key]
    );
    prefixDraft.value[key] = data.orderPrefix;
    needsPrefixReview.value = false;
    useAlert(t('GOTCHU_SHOPIFY.PREFIX_SAVED'));
    await load();
  } catch (error) {
    alertFor(error);
  }
};

onMounted(async () => {
  const query = returnQuery();
  if (query !== null) await dropQueryFromAddressBar();
  await load();
  // A dark app has nothing to complete; it also has no way to have sent the
  // merchant here.
  if (query !== null && available.value) await completeInstall(query);
});
</script>

<template>
  <section v-if="available" class="flex flex-col gap-4 pb-8">
    <p v-if="completing" class="text-sm text-n-slate-11">
      {{ t('GOTCHU_SHOPIFY.COMPLETING') }}
    </p>
    <p
      v-else-if="connectedKey"
      class="rounded-lg bg-n-teal-3 px-3 py-2 text-sm text-n-teal-11"
    >
      {{ t('GOTCHU_SHOPIFY.CONNECTED', { key: connectedKey }) }}
      <span v-if="needsPrefixReview">
        {{ t('GOTCHU_SHOPIFY.PREFIX_REVIEW') }}
      </span>
    </p>

    <form class="flex items-end gap-2" @submit.prevent="connect()">
      <label class="flex flex-1 flex-col gap-1 text-sm text-n-slate-12">
        {{ t('GOTCHU_SHOPIFY.SHOP_LABEL') }}
        <input
          v-model="shop"
          type="text"
          class="!mb-0"
          :placeholder="t('GOTCHU_SHOPIFY.SHOP_PLACEHOLDER')"
          autocomplete="off"
        />
      </label>
      <Button
        type="submit"
        :label="t('GOTCHU_SHOPIFY.CONNECT')"
        color="slate"
        :is-loading="connecting"
        :disabled="!shop.trim()"
      />
    </form>

    <p v-if="!stores.length" class="text-sm text-n-slate-11">
      {{ t('GOTCHU_SHOPIFY.EMPTY') }}
    </p>
    <ul v-else class="flex flex-col divide-y divide-n-weak">
      <li
        v-for="store in stores"
        :key="store.key"
        class="flex items-center gap-3 py-3"
      >
        <div class="flex flex-1 flex-col">
          <span class="font-medium text-n-slate-12">{{ store.name }}</span>
          <span class="text-xs text-n-slate-11">{{ store.shopDomain }}</span>
        </div>
        <span
          class="rounded px-2 py-0.5 text-xs"
          :class="
            store.status === 'active'
              ? 'bg-n-teal-3 text-n-teal-11'
              : 'bg-n-ruby-3 text-n-ruby-11'
          "
        >
          {{
            STATUS_KEYS[store.status]
              ? t(STATUS_KEYS[store.status])
              : store.status
          }}
        </span>
        <form
          v-if="store.auth === 'oauth'"
          class="flex items-center gap-1"
          @submit.prevent="savePrefix(store.key)"
        >
          <input
            v-model="prefixDraft[store.key]"
            class="!mb-0 w-24"
            maxlength="10"
            :aria-label="t('GOTCHU_SHOPIFY.PREFIX_LABEL')"
          />
          <Button
            type="submit"
            size="sm"
            variant="faded"
            :label="t('GOTCHU_SHOPIFY.PREFIX_SAVE')"
          />
        </form>
        <Button
          v-if="store.status === 'disconnected' && store.auth === 'oauth'"
          size="sm"
          :label="t('GOTCHU_SHOPIFY.RECONNECT')"
          @click="connect(store.shopDomain)"
        />
      </li>
    </ul>
  </section>
</template>
