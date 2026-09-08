<script setup>
import { computed } from 'vue';
import { format } from 'date-fns';
import { useI18n, I18nT } from 'vue-i18n';

const props = defineProps({
  order: {
    type: Object,
    required: true,
  },
});

const { t } = useI18n();

const formatDate = dateString => {
  return format(new Date(dateString), 'MMM d, yyyy');
};

const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: currency || 'USD',
  }).format(amount);
};

const getStatusI18nKey = (type, status = '') => {
  return `CONVERSATION_SIDEBAR.SHOPIFY.${type.toUpperCase()}_STATUS.${status.toUpperCase()}`;
};

const fulfillmentStatus = computed(() => {
  const { fulfillment_status: status } = props.order;
  if (!status) {
    return '';
  }
  return t(getStatusI18nKey('FULFILLMENT', status));
});

const financialStatus = computed(() => {
  const { financial_status: status } = props.order;
  if (!status) {
    return '';
  }
  return t(getStatusI18nKey('FINANCIAL', status));
});

// "Paid Mar 12, 2026 · €38.00" — the design hangs the payment state, the date
// and the total off the right of the order number as one muted line, so the
// three pieces are joined here rather than laid out in the template. Two
// reasons it is script-side: the separator has to survive a missing financial
// status without leaving a dangling `·`, and a bare `·` in the template is a
// `vue/no-bare-strings-in-template` error whose allowlist is shared config.
const orderSummary = computed(() => {
  const paidOn = [financialStatus.value, formatDate(props.order.created_at)]
    .filter(Boolean)
    .join(' ');
  const total = formatCurrency(props.order.total_price, props.order.currency);
  return [paidOn, total].filter(Boolean).join(' · ');
});
</script>

<template>
  <div
    class="flex flex-col gap-2 py-3 border-b border-[var(--g-border)] last:border-b-0"
  >
    <div class="flex items-center justify-between gap-3">
      <a
        :href="order.admin_url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center min-w-0 gap-1.5 font-medium cursor-pointer text-n-slate-12 hover:underline"
      >
        <span class="flex-shrink-0 i-lucide-package size-3.5 text-n-slate-11" />
        <I18nT
          keypath="CONVERSATION_SIDEBAR.SHOPIFY.ORDER_ID"
          tag="span"
          class="truncate"
        >
          <template #id>
            <span class="font-[family-name:var(--g-font-mono)]">
              {{ order.id }}
            </span>
          </template>
        </I18nT>
        <span
          class="flex-shrink-0 i-lucide-external-link size-3.5 text-n-slate-11"
        />
      </a>
      <span
        class="flex-shrink-0 text-xs leading-4 text-n-slate-11"
        :title="orderSummary"
      >
        {{ orderSummary }}
      </span>
    </div>
    <div v-if="fulfillmentStatus">
      <span
        class="inline-flex items-center px-2 py-px text-xs leading-4 capitalize border rounded-[var(--g-radius-control)] border-[var(--g-agent-border)] text-[var(--g-agent)]"
        :title="fulfillmentStatus"
      >
        {{ fulfillmentStatus }}
      </span>
    </div>
  </div>
</template>
