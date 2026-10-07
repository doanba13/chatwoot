<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAccount } from 'dashboard/composables/useAccount';
import Button from 'dashboard/components-next/button/Button.vue';
import NotBuiltChip from 'dashboard/components-next/gotchu/agent/NotBuiltChip.vue';
import DrawerCard from './DrawerCard.vue';
import ShippingSteps from './ShippingSteps.vue';
import { drawerView } from './drawerView';
import { useOrderContext } from './useOrderContext';

const props = defineProps({
  conversationId: { type: [Number, String], required: true },
  contact: { type: Object, default: () => ({}) },
  lang: { type: String, default: null },
  // The gallery's stand-in for the read: { context, state }. Never set in the app.
  previewContext: { type: Object, default: null },
});

const { t, te, locale } = useI18n();
const { accountId } = useAccount();

const live = props.previewContext
  ? null
  : useOrderContext(computed(() => props.conversationId));
const context = computed(() =>
  live ? live.context.value : props.previewContext.context
);
const state = computed(() =>
  live ? live.state.value : (props.previewContext.state ?? 'ready')
);
const refreshing = computed(() => (live ? live.refreshing.value : false));
const refresh = () => live?.refresh();

const view = computed(() =>
  state.value === 'ready'
    ? drawerView(context.value, {
        t,
        te,
        lang: props.lang,
        locale: locale.value,
      })
    : null
);

const title = computed(() => view.value?.title ?? t('GOTCHU.DRAWER.ORDER'));
const notAvailable = computed(() => {
  if (state.value === 'unconfigured')
    return t('GOTCHU.DRAWER.NOT_AVAILABLE', {
      reason: t('GOTCHU.DRAWER.REASON.UNCONFIGURED'),
    });
  if (state.value === 'unavailable')
    return t('GOTCHU.DRAWER.NOT_AVAILABLE', {
      reason: t('GOTCHU.DRAWER.REASON.UNAVAILABLE'),
    });
  return null;
});
// A retry can succeed on `unavailable`, never on `unconfigured`.
const canRefresh = computed(() => state.value !== 'unconfigured');

const customer = computed(() => view.value?.customer);
const customerName = computed(
  () => customer.value?.name ?? props.contact?.name ?? ''
);
const initials = computed(
  () =>
    customer.value?.initials ??
    String(props.contact?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map(p => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
);
const contactLink = computed(() =>
  props.contact?.id
    ? `/app/accounts/${accountId.value}/contacts/${props.contact.id}`
    : null
);
</script>

<template>
  <div class="flex flex-col" data-testid="order-drawer">
    <div class="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
      <h2 class="m-0 text-[15px] leading-5 font-semibold text-[var(--g-text)]">
        {{ title }}
      </h2>
      <Button
        v-if="canRefresh"
        data-testid="drawer-refresh"
        variant="ghost"
        size="xs"
        :label="t('GOTCHU.DRAWER.REFRESH')"
        :aria-label="t('GOTCHU.DRAWER.REFRESH_LABEL')"
        :disabled="refreshing"
        @click="refresh"
      />
    </div>

    <div class="px-4">
      <p
        v-if="state === 'loading'"
        class="m-0 text-[13px] text-[var(--g-text-muted)]"
      >
        {{ t('GOTCHU.DRAWER.LOADING') }}
      </p>

      <p
        v-else-if="notAvailable"
        data-testid="drawer-not-available"
        class="p-4 m-0 text-[13px] text-[var(--g-text-muted)] border border-solid border-[var(--g-border)] rounded-[10px]"
      >
        {{ notAvailable }}
      </p>

      <template v-else-if="view">
        <section
          v-if="view.ambiguous"
          data-testid="drawer-ambiguous"
          class="flex flex-col gap-2 p-4 mb-3 border border-solid border-[var(--g-border)] rounded-[10px]"
        >
          <p class="m-0 text-[13px] text-[var(--g-text)]">{{ view.notice }}</p>
          <ul class="flex flex-col gap-1 p-0 m-0 list-none">
            <li
              v-for="c in view.candidates"
              :key="`${c.storeKey}-${c.orderName}`"
              class="text-[13px] text-[var(--g-text-muted)]"
            >
              {{ c.orderName }} · {{ c.storeKey }}
            </li>
          </ul>
        </section>

        <p
          v-else-if="view.notice && !view.shipping"
          class="mt-0 mb-3 text-[13px] text-[var(--g-text-muted)]"
        >
          {{ view.notice }}
        </p>

        <section
          v-if="!view.ambiguous"
          data-testid="drawer-customer"
          class="flex flex-col gap-3 p-4 mb-3 border border-solid border-[var(--g-border)] rounded-[10px] bg-[var(--g-surface)]"
        >
          <h3 class="sr-only">{{ t('GOTCHU.DRAWER.CUSTOMER') }}</h3>
          <div class="flex items-center gap-3">
            <span
              class="flex items-center justify-center text-[13px] font-semibold rounded-full size-9 shrink-0 bg-[var(--g-surface-tank)] text-[var(--g-text)]"
              aria-hidden="true"
            >
              {{ initials }}
            </span>
            <div class="flex flex-col min-w-0">
              <span
                class="text-[14px] font-semibold truncate text-[var(--g-text)]"
              >
                {{ customerName }}
              </span>
              <span
                v-if="customer?.subline"
                class="text-[12px] text-[var(--g-text-muted)]"
              >
                {{ customer.subline }}
              </span>
            </div>
          </div>
          <dl v-if="customer?.rows.length" class="flex flex-col gap-1 m-0">
            <div
              v-for="r in customer.rows"
              :key="r.k"
              class="flex justify-between gap-3 text-[13px]"
            >
              <dt class="text-[var(--g-text-muted)] whitespace-nowrap">
                {{ r.k }}
              </dt>
              <dd class="m-0 text-right break-words text-[var(--g-text)]">
                {{ r.v }}
              </dd>
            </div>
          </dl>
          <p
            v-if="customer?.piiNotice"
            class="m-0 text-[12px] text-[var(--g-text-muted)]"
          >
            {{ customer.piiNotice }}
          </p>
          <a
            v-if="contactLink"
            :href="contactLink"
            class="text-[13px] font-medium text-[var(--g-brand)]"
          >
            {{ t('GOTCHU.DRAWER.OPEN_CONTACT') }}
          </a>
        </section>

        <DrawerCard v-if="view.shipping" :title="t('GOTCHU.DRAWER.SHIPPING')">
          <template #summary>
            <span
              class="px-2 text-[12px] font-medium rounded-full bg-[var(--g-surface-tank)] text-[var(--g-text)]"
            >
              {{ view.shipping.stateWord }}
            </span>
          </template>
          <ShippingSteps :steps="view.shipping.steps" />
          <p class="m-0 text-[12px] text-[var(--g-text-muted)]">
            {{ view.shipping.checked }}
          </p>
          <p
            v-if="view.shipping.notice"
            class="m-0 text-[12px] text-[var(--g-text-muted)]"
          >
            {{ view.shipping.notice }}
          </p>
        </DrawerCard>

        <DrawerCard v-if="view.order" :title="t('GOTCHU.DRAWER.ORDER')">
          <template #summary>
            <span class="text-[13px] text-[var(--g-text)]">
              {{ view.order.total }}
            </span>
          </template>
          <dl class="flex flex-col gap-1 m-0">
            <div
              v-for="r in view.order.rows"
              :key="r.k"
              class="flex justify-between gap-3 text-[13px]"
            >
              <dt class="text-[var(--g-text-muted)] whitespace-nowrap">
                {{ r.k }}
              </dt>
              <dd class="m-0 text-right text-[var(--g-text)]">{{ r.v }}</dd>
            </div>
          </dl>
        </DrawerCard>

        <DrawerCard
          v-if="!view.ambiguous"
          :title="t('GOTCHU.DRAWER.ACTIONS')"
          :default-open="false"
        >
          <div
            v-for="key in ['GOODWILL', 'CANCEL_ORDER']"
            :key="key"
            class="flex items-center justify-between gap-2"
          >
            <Button
              variant="faded"
              color="slate"
              size="sm"
              disabled
              :label="t(`GOTCHU.DRAWER.${key}`)"
            />
            <NotBuiltChip />
          </div>
        </DrawerCard>
      </template>
    </div>
  </div>
</template>
