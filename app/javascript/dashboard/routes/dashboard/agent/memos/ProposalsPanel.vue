<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import MemoProposalsAPI from 'dashboard/api/gotchu/memoProposals';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';

import SidePanel from 'dashboard/components-next/side-panel/SidePanel.vue';
import ProposalCard from './ProposalCard.vue';

// The pending proposals in a side panel, opened through `open()`. A decided
// card leaves, and the list is read again so the count stays true.
const emit = defineEmits(['changed']);
const { t } = useI18n();
const panel = ref(null);
const proposals = ref([]);
const errorKey = ref('');

const load = async () => {
  errorKey.value = '';
  try {
    const { data } = await MemoProposalsAPI.list();
    proposals.value = data.proposals ?? [];
  } catch (error) {
    errorKey.value = gatewayErrorKey(error);
  }
};

const onDecided = async id => {
  proposals.value = proposals.value.filter(p => p.id !== id);
  emit('changed');
  await load();
};

const open = async () => {
  panel.value?.open();
  await load();
};

defineExpose({ open });
</script>

<template>
  <SidePanel ref="panel" :title="t('GOTCHU_AGENT.MEMO.PROPOSALS_TITLE')">
    <div class="flex flex-col gap-3">
      <p v-if="errorKey" class="mb-0 text-sm text-[var(--g-danger-text)]">
        {{ t(errorKey) }}
      </p>
      <p
        v-else-if="!proposals.length"
        class="mb-0 text-sm text-[var(--g-text-muted)]"
      >
        {{ t('GOTCHU_AGENT.MEMO.NO_PROPOSALS') }}
      </p>
      <ProposalCard
        v-for="proposal in proposals"
        :key="proposal.id"
        :proposal="proposal"
        @decided="onDecided"
      />
    </div>
  </SidePanel>
</template>
