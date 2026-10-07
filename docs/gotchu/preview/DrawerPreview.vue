<script setup>
import OrderDrawer from 'dashboard/components-next/gotchu/drawer/OrderDrawer.vue';
import {
  persoliebe,
  cadeauniq,
} from 'dashboard/components-next/gotchu/drawer/specs/fixtures';

// The drawer's states through its previewContext override: no gateway, no store.
const drawerStates = [
  { name: 'persoliebe', context: persoliebe, state: 'ready', lang: 'de' },
  { name: 'cadeauniq, customer details hidden', context: cadeauniq, state: 'ready', lang: 'fr' },
  {
    name: 'ambiguous',
    context: {
      ...persoliebe,
      ambiguous: true,
      candidates: [
        { orderName: 'PL-5713', storeKey: 'persoliebe' },
        { orderName: 'PL-5702', storeKey: 'persoliebe' },
      ],
    },
    state: 'ready',
    lang: 'de',
  },
  { name: 'lookup did not answer', context: null, state: 'unavailable', lang: 'de' },
];
</script>

<template>
  <div class="flex flex-wrap items-start gap-6 p-4 bg-[var(--g-bg)]">
    <div v-for="d in drawerStates" :key="d.name" class="flex flex-col gap-2">
      <span class="text-xs text-[var(--g-text-muted)]">{{ d.name }}</span>
      <div
        class="w-[340px] pb-4 border border-solid rounded-[10px] bg-[var(--g-bg)] border-[var(--g-border)]"
      >
        <OrderDrawer
          :conversation-id="41"
          :contact="{ id: 3, name: 'Sabine Keller' }"
          :lang="d.lang"
          :preview-context="{ context: d.context, state: d.state }"
        />
      </div>
    </div>
  </div>
</template>
