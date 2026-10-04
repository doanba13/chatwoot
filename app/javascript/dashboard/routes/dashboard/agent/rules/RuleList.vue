<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useMapGetter } from 'dashboard/composables/store';

import RulesAPI from 'dashboard/api/gotchu/rules';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { conditionChips, sendingKey, usedLabel } from './ruleView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import NotBuiltChip from 'dashboard/components-next/gotchu/agent/NotBuiltChip.vue';
import ScopeChip from 'dashboard/components-next/gotchu/agent/ScopeChip.vue';
import StatusPill from 'dashboard/components-next/gotchu/agent/StatusPill.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import TabBar from 'dashboard/components-next/tabbar/TabBar.vue';
import {
  BaseTable,
  BaseTableRow,
  BaseTableCell,
} from 'dashboard/components-next/table';

const { t, te } = useI18n();
const router = useRouter();
const currentRole = useMapGetter('getCurrentRole');
const isAdmin = computed(() => currentRole.value === 'administrator');
const { stores, inboxes, storeIndex, load: loadStores } = useGotchuStores();

const isLoading = ref(true);
const available = ref(true);
const errorKey = ref('');
const rules = ref([]);

// The list is read once, every status, and filtered here; the first tab is
// the default: what can shape a draft today, live or being tested.
const FILTERS = [
  { key: 'live', statuses: ['active', 'testing'] },
  { key: 'active', statuses: ['active'] },
  { key: 'testing', statuses: ['testing'] },
  { key: 'archived', statuses: ['archived'] },
  { key: 'all', statuses: null },
];
const filterIndex = ref(0);
const tabs = computed(() =>
  FILTERS.map(f => ({
    key: f.key,
    // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
    label: t(`GOTCHU_AGENT.RULE.FILTER.${f.key.toUpperCase()}`),
  }))
);
const shown = computed(() => {
  const { statuses } = FILTERS[filterIndex.value];
  return statuses
    ? rules.value.filter(r => statuses.includes(r.status))
    : rules.value;
});
const onTab = tab => {
  filterIndex.value = FILTERS.findIndex(f => f.key === tab.key);
};

const load = async () => {
  isLoading.value = true;
  errorKey.value = '';
  loadStores().catch(() => {});
  try {
    const { data } = await RulesAPI.list();
    available.value = data.capabilities?.rules === true;
    rules.value = data.rules ?? [];
  } catch (error) {
    available.value = error?.response?.status !== 503;
    errorKey.value = gatewayErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

const chips = rule => conditionChips(rule.conditions, t, te);
const used = rule => {
  const { key, n } = usedLabel(rule);
  return t(key, { n });
};
const SENDING_TONE = {
  never_auto:
    'px-2 py-0.5 rounded-full bg-[var(--g-slate-tint)] text-[var(--g-text)]',
  hand_over:
    'px-2 py-0.5 rounded-full bg-[var(--g-danger-tint)] text-[var(--g-danger-text)]',
  no_change: 'text-[var(--g-text-muted)]',
};

// A named route keeps the current accountId param, so only the id travels.
const ruleRoute = rule => ({
  name: 'agent_rule',
  params: { ruleId: rule.id },
});

const headers = computed(() => [
  t('GOTCHU_AGENT.RULE.COL_WHEN'),
  t('GOTCHU_AGENT.RULE.COL_SAY'),
  t('GOTCHU_AGENT.RULE.COL_SENDING'),
  t('GOTCHU_AGENT.RULE.COL_SCOPE'),
  t('GOTCHU_AGENT.RULE.COL_USED'),
]);

onMounted(load);
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader
        :title="t('GOTCHU_AGENT.RULE.LIST_TITLE')"
        :lede="t('GOTCHU_AGENT.RULE.LIST_LEDE')"
      >
        <template #actions>
          <Button
            v-if="isAdmin && available"
            :label="t('GOTCHU_AGENT.RULE.NEW')"
            icon="i-lucide-plus"
            size="sm"
            data-testid="rule-new"
            @click="router.push({ name: 'agent_rule_new' })"
          />
        </template>
      </GotchuPageHeader>
    </template>

    <div class="flex flex-col gap-1 text-sm text-[var(--g-text-muted)]">
      <p class="mb-0 font-semibold text-[var(--g-text)]">
        {{ t('GOTCHU_AGENT.RULE.LIST_NOTE') }}
      </p>
      <p class="flex flex-wrap items-center gap-2 mb-0">
        {{ t('GOTCHU_AGENT.RULE.BASE_NOTE') }}
        <span class="underline">{{
          t('GOTCHU_AGENT.RULE.WHAT_THEY_COVER')
        }}</span>
        <NotBuiltChip />
      </p>
    </div>

    <AgentUnconfigured v-if="!isLoading && !available" />
    <template v-else>
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="rules-error"
      >
        {{ t(errorKey) }}
      </p>
      <TabBar
        :tabs="tabs"
        :initial-active-tab="filterIndex"
        @tab-changed="onTab"
      />
      <BaseTable
        v-if="!isLoading"
        :headers="headers"
        :items="shown"
        :no-data-message="t('GOTCHU_AGENT.RULE.EMPTY')"
      >
        <template #row="{ items }">
          <BaseTableRow
            v-for="rule in items"
            :key="rule.id"
            :item="rule"
            :data-testid="`rule-row-${rule.id}`"
          >
            <BaseTableCell>
              <span class="flex flex-wrap items-center gap-1.5">
                <span
                  v-for="(chip, i) in chips(rule)"
                  :key="i"
                  class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-[var(--g-radius-tag)] bg-[var(--g-surface-tank)] text-[var(--g-text-muted)]"
                >
                  {{ chip.label }}
                  <strong class="font-semibold text-[var(--g-text)]">
                    {{ chip.value }}
                  </strong>
                </span>
              </span>
            </BaseTableCell>
            <BaseTableCell>
              <span class="flex flex-col gap-1">
                <span class="flex flex-wrap items-center gap-2">
                  <router-link
                    :to="ruleRoute(rule)"
                    class="font-semibold text-[var(--g-text)] no-underline"
                  >
                    {{ rule.title }}
                  </router-link>
                  <StatusPill
                    v-if="rule.status !== 'active'"
                    :status="rule.status"
                  />
                </span>
                <span
                  v-if="rule.say"
                  class="text-sm text-[var(--g-text-muted)]"
                >
                  {{ rule.say }}
                </span>
              </span>
            </BaseTableCell>
            <BaseTableCell>
              <span
                class="text-xs font-semibold"
                :class="SENDING_TONE[rule.sending]"
              >
                {{ t(sendingKey(rule.sending)) }}
              </span>
            </BaseTableCell>
            <BaseTableCell>
              <ScopeChip
                :scope="rule.scope"
                :stores="stores"
                :inboxes="inboxes"
                :store-index="storeIndex"
                :target-missing="rule.targetMissing"
              />
            </BaseTableCell>
            <BaseTableCell>
              <span class="text-sm text-[var(--g-text)]">{{ used(rule) }}</span>
            </BaseTableCell>
          </BaseTableRow>
        </template>
      </BaseTable>
    </template>
  </AgentPage>
</template>
