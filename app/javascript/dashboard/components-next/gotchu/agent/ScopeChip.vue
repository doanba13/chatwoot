<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { scopeLabel } from './scopeView';

const props = defineProps({
  scope: { type: Object, required: true },
  stores: { type: Array, required: true },
  inboxes: { type: Array, required: true },
  storeIndex: { type: Function, required: true },
  targetMissing: { type: Boolean, default: false },
});
const { t } = useI18n();
const label = computed(() =>
  scopeLabel(props.scope, { stores: props.stores, inboxes: props.inboxes })
);
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1.5">
    <!-- Boards 5 and 7: the scope is a chip, tank for a store or all stores,
      lilac for one inbox. -->
    <span
      class="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-semibold rounded-full text-[var(--g-text)] whitespace-nowrap"
      :class="
        label.inbox
          ? 'bg-[var(--g-surface-inbox)]'
          : 'bg-[var(--g-surface-tank)]'
      "
      data-testid="scope-chip"
    >
      <span
        v-if="label.store"
        class="size-2 rounded-full"
        :style="{
          background: `var(--g-store-${storeIndex(label.store) ?? 5})`,
        }"
      />
      {{ label.store ?? t('GOTCHU_AGENT.SCOPE.ALL_STORES') }}
      <template v-if="label.inbox"> · {{ label.inbox }}</template>
    </span>
    <span v-if="label.except.length" class="text-[var(--g-text-muted)]">
      {{ t('GOTCHU_AGENT.SCOPE.OFF_ON', { inboxes: label.except.join(', ') }) }}
    </span>
    <span v-if="targetMissing" class="text-[var(--g-danger-text)]">
      {{ t('GOTCHU_AGENT.SCOPE.TARGET_MISSING') }}
    </span>
  </span>
</template>
