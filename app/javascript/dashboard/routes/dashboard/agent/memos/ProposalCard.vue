<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

import MemoProposalsAPI from 'dashboard/api/gotchu/memoProposals';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { proposalStores } from './memoView';

import Button from 'dashboard/components-next/button/Button.vue';

// One nightly memo proposal (spec §6.4, a §11 ProposalView): Remember or
// Dismiss. A 409 means someone else already decided; the card goes either
// way, and the person is told.
const props = defineProps({
  proposal: { type: Object, required: true },
});
const emit = defineEmits(['decided']);

const { t } = useI18n();
const busy = ref(false);

const decide = async decision => {
  if (busy.value) return;
  busy.value = true;
  try {
    await MemoProposalsAPI.decide(props.proposal.id, decision);
    emit('decided', props.proposal.id);
  } catch (error) {
    if (error?.response?.status === 409) {
      useAlert(t('GOTCHU_AGENT.MEMO.ALREADY_DECIDED'));
      emit('decided', props.proposal.id);
    } else {
      useAlert(t(gatewayErrorKey(error)));
    }
  } finally {
    busy.value = false;
  }
};
</script>

<template>
  <div
    class="flex flex-col gap-2 p-4 rounded-[var(--g-radius-card)] bg-[var(--g-surface-note)] border border-[var(--g-border)]"
    :data-testid="`proposal-${proposal.id}`"
  >
    <p class="mb-0 [font:var(--g-text-body)] text-[var(--g-text)]">
      {{ proposal.text }}
    </p>
    <p class="mb-0 text-xs text-[var(--g-text-muted)]">
      {{
        t('GOTCHU_AGENT.MEMO.SAID_TIMES', {
          n: proposal.conversationCount,
          stores: proposalStores(proposal.storeKeys ?? [], t),
        })
      }}
    </p>
    <div class="flex gap-2">
      <Button
        :label="t('GOTCHU_AGENT.MEMO.REMEMBER')"
        size="sm"
        :is-loading="busy"
        data-testid="proposal-remember"
        @click="decide('confirm')"
      />
      <Button
        :label="t('GOTCHU_AGENT.MEMO.DISMISS')"
        size="sm"
        variant="faded"
        color="slate"
        :disabled="busy"
        data-testid="proposal-dismiss"
        @click="decide('dismiss')"
      />
    </div>
  </div>
</template>
