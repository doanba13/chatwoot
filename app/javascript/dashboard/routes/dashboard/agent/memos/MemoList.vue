<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMapGetter, useStore } from 'dashboard/composables/store';

import MemosAPI from 'dashboard/api/gotchu/memos';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { kindLabel, originLabel } from './memoView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import ScopeChip from 'dashboard/components-next/gotchu/agent/ScopeChip.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import { BRAND_BUTTON_CLASS } from 'dashboard/components-next/gotchu/agent/brandButton';
import {
  BaseTable,
  BaseTableRow,
  BaseTableCell,
} from 'dashboard/components-next/table';
import ProposalsPanel from './ProposalsPanel.vue';

const { t } = useI18n();
const router = useRouter();
const store = useStore();
const agents = useMapGetter('agents/getAgents');
const { stores, inboxes, storeIndex, load: loadStores } = useGotchuStores();

const isLoading = ref(true);
const available = ref(true);
const errorKey = ref('');
const memos = ref([]);
const proposalsPending = ref(0);
const proposalsPanel = ref(null);

const agentsById = computed(() =>
  Object.fromEntries((agents.value ?? []).map(a => [a.id, a]))
);

const load = async () => {
  isLoading.value = true;
  errorKey.value = '';
  loadStores().catch(() => {});
  try {
    const { data } = await MemosAPI.list();
    available.value = data.capabilities?.memos === true;
    memos.value = data.memos ?? [];
    proposalsPending.value = data.proposalsPending ?? 0;
  } catch (error) {
    available.value = error?.response?.status !== 503;
    errorKey.value = gatewayErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

const from = memo => {
  const { key, params } = originLabel(memo, agentsById.value, t);
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  return t(key, params);
};
const kind = memo => {
  const { key, params } = kindLabel(memo);
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  return params.kind ? t(key, { ...params, kind: t(params.kind) }) : t(key);
};
// A memo's scope has no except list; ScopeChip reads one.
const scopeOf = memo => ({ ...memo.scope, exceptInboxIds: [] });

const headers = computed(() => [
  t('GOTCHU_AGENT.MEMO.COL_MEMO'),
  t('GOTCHU_AGENT.MEMO.COL_KIND'),
  t('GOTCHU_AGENT.MEMO.COL_SCOPE'),
  t('GOTCHU_AGENT.MEMO.COL_FROM'),
]);

onMounted(() => {
  store.dispatch('agents/get');
  load();
});
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader
        :title="t('GOTCHU_AGENT.MEMO.LIST_TITLE')"
        :lede="t('GOTCHU_AGENT.MEMO.LIST_LEDE')"
      >
        <template #actions>
          <Button
            v-if="available"
            :label="t('GOTCHU_AGENT.MEMO.NEW')"
            size="sm"
            color="slate"
            no-animation
            :class="BRAND_BUTTON_CLASS"
            data-testid="memo-new"
            @click="router.push({ name: 'agent_memo_new' })"
          />
        </template>
      </GotchuPageHeader>
    </template>

    <AgentUnconfigured v-if="!isLoading && !available" />
    <template v-else>
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="memos-error"
      >
        {{ t(errorKey) }}
      </p>
      <BaseTable
        v-if="!isLoading && !errorKey"
        boxed
        :headers="headers"
        :items="memos"
        :no-data-message="t('GOTCHU_AGENT.MEMO.EMPTY')"
      >
        <template #row="{ items }">
          <BaseTableRow
            v-for="memo in items"
            :key="memo.id"
            :item="memo"
            :data-testid="`memo-row-${memo.id}`"
          >
            <BaseTableCell>
              <router-link
                :to="{ name: 'agent_memo', params: { memoId: memo.id } }"
                class="text-[var(--g-text)] no-underline"
              >
                {{ memo.text }}
              </router-link>
            </BaseTableCell>
            <BaseTableCell>
              <span class="text-sm text-[var(--g-text)]">{{ kind(memo) }}</span>
            </BaseTableCell>
            <BaseTableCell>
              <ScopeChip
                :scope="scopeOf(memo)"
                :stores="stores"
                :inboxes="inboxes"
                :store-index="storeIndex"
                :target-missing="memo.targetMissing"
              />
            </BaseTableCell>
            <BaseTableCell>
              <span class="text-sm text-[var(--g-text-muted)]">
                {{ from(memo) }}
              </span>
            </BaseTableCell>
          </BaseTableRow>
        </template>
      </BaseTable>

      <div
        v-if="proposalsPending > 0"
        class="flex flex-wrap items-center gap-3 px-4 py-3 rounded-[var(--g-radius-card)] bg-[var(--g-agent-soft)]"
        data-testid="memo-proposals-waiting"
      >
        <span class="text-sm text-[var(--g-text)]">
          {{
            t(
              'GOTCHU_AGENT.MEMO.PROPOSALS_WAITING',
              { n: proposalsPending },
              proposalsPending
            )
          }}
        </span>
        <Button
          :label="t('GOTCHU_AGENT.MEMO.REVIEW')"
          size="sm"
          variant="faded"
          data-testid="memo-proposals-review"
          @click="proposalsPanel?.open()"
        />
      </div>
    </template>
    <ProposalsPanel ref="proposalsPanel" @changed="load" />
  </AgentPage>
</template>
