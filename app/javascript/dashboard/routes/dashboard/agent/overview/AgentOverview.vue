<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useIntervalFn } from '@vueuse/core';
import { useMapGetter } from 'dashboard/composables/store';

import AgentAPI from 'dashboard/api/gotchu/agent';
import MemoProposalsAPI from 'dashboard/api/gotchu/memoProposals';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { CHANNELS } from '../procedures/procedureView';
import { secondsLeft, share, statusSentence } from './overviewView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import NotBuiltChip from 'dashboard/components-next/gotchu/agent/NotBuiltChip.vue';
import TierChip from 'dashboard/components-next/gotchu/agent/TierChip.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import {
  BaseTable,
  BaseTableRow,
  BaseTableCell,
} from 'dashboard/components-next/table';
import ProposalCard from '../memos/ProposalCard.vue';

const { t } = useI18n();
const router = useRouter();
const currentRole = useMapGetter('getCurrentRole');
const isAdmin = computed(() => currentRole.value === 'administrator');
const { stores, load: loadStores } = useGotchuStores();

const O = 'GOTCHU_AGENT.OVERVIEW.';

const isLoading = ref(true);
const available = ref(true);
const errorKey = ref('');
const overview = ref(null);
const proposals = ref([]);
const now = ref(new Date());

// What each Stop came to, by cycle id, so a refetch that still lists the
// cycle does not wipe the answer. `stopped` only on a 200; a 409 is
// `not_holding` (spec §9.6: the release or another person's Stop won, and
// this page cannot say which).
const outcome = reactive({});
const stopping = reactive({});

const loadOverview = async () => {
  try {
    const { data } = await AgentAPI.overview(7);
    available.value = data.capabilities?.overview === true;
    overview.value = available.value ? data : null;
    errorKey.value = '';
  } catch (error) {
    available.value = error?.response?.status !== 503;
    errorKey.value = gatewayErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

const loadProposals = async () => {
  try {
    const { data } = await MemoProposalsAPI.list();
    proposals.value = (data.proposals ?? []).slice(0, 3);
  } catch {
    proposals.value = [];
  }
};

const stop = async cycleId => {
  if (stopping[cycleId]) return;
  stopping[cycleId] = true;
  try {
    await AgentAPI.stopAuto(cycleId);
    outcome[cycleId] = { key: `${O}STOPPED` };
  } catch (error) {
    if (error?.response?.status === 409) {
      outcome[cycleId] = { key: `${O}NOT_HOLDING` };
      await loadOverview();
    } else {
      outcome[cycleId] = { key: gatewayErrorKey(error), retry: true };
    }
  } finally {
    stopping[cycleId] = false;
  }
};

const onProposalDecided = id => {
  proposals.value = proposals.value.filter(p => p.id !== id);
};

const procedures = computed(() => overview.value?.procedures ?? []);
const holding = computed(() => overview.value?.holding ?? []);
const noMatchCount = computed(() => overview.value?.noMatch?.count ?? 0);

const sentence = computed(() => {
  if (!overview.value) return '';
  const { key, params } = statusSentence({
    procedures: procedures.value,
    storeCount: stores.value.length,
  });
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  return params.n ? t(key, params, params.n) : t(key, params);
});

// eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
const channelLabel = channel =>
  t(`GOTCHU_AGENT.CHANNEL.${channel.toUpperCase()}`);
const tierOf = (procedure, channel) => procedure.tiers?.[channel] ?? 'off';

const nothingToDecide = computed(
  () => !holding.value.length && !proposals.value.length
);

const headers = computed(() => [
  t(`${O}COL_PROCEDURE`),
  t(`${O}COL_TIERS`),
  t(`${O}COL_USED`),
  t(`${O}COL_UNEDITED`),
  t(`${O}COL_HANDED`),
]);

// The countdown ticks every second; the overview re-reads every 30 s while
// the page is visible, which is what drops a released or stopped hold.
const tick = setInterval(() => {
  now.value = new Date();
}, 1000);
onBeforeUnmount(() => clearInterval(tick));
useIntervalFn(() => {
  if (document.visibilityState === 'visible') loadOverview();
}, 30000);

onMounted(() => {
  loadStores().catch(() => {});
  loadOverview();
  loadProposals();
});
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader :title="t(`${O}TITLE`)" :lede="sentence">
        <template #actions>
          <Button
            v-if="isAdmin && available"
            :label="t(`${O}NEW_PROCEDURE`)"
            icon="i-lucide-plus"
            size="sm"
            data-testid="overview-new-procedure"
            @click="router.push({ name: 'agent_procedure_new' })"
          />
          <span class="inline-flex items-center gap-2">
            <Button
              :label="t(`${O}PAUSE`)"
              size="sm"
              variant="faded"
              color="slate"
              disabled
            />
            <NotBuiltChip />
          </span>
        </template>
      </GotchuPageHeader>
    </template>

    <AgentUnconfigured v-if="!isLoading && !available" />
    <template v-else>
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="overview-error"
      >
        {{ t(errorKey) }}
      </p>
      <section v-if="overview" class="flex flex-col gap-3">
        <h2 class="m-0 [font:var(--g-text-section)] text-[var(--g-text)]">
          {{ t(`${O}PROCEDURES`) }}
          <span class="font-normal text-[var(--g-text-muted)]">
            · {{ t(`${O}LAST_7`) }}
          </span>
        </h2>
        <BaseTable :headers="headers" :items="procedures">
          <template #row="{ items }">
            <BaseTableRow
              v-for="procedure in items"
              :key="procedure.id"
              :item="procedure"
              :data-testid="`overview-procedure-${procedure.id}`"
            >
              <BaseTableCell>
                <router-link
                  :to="{
                    name: 'agent_procedure',
                    params: { procedureId: procedure.id },
                  }"
                  class="font-semibold text-[var(--g-text)] no-underline"
                >
                  {{ procedure.title }}
                </router-link>
                <p class="mt-0.5 mb-0 text-xs text-[var(--g-text-muted)]">
                  {{
                    t('GOTCHU_AGENT.STATUS_WITH_VERSION', {
                      status: t(
                        `GOTCHU_AGENT.STATUS.${procedure.status.toUpperCase()}`
                      ),
                      version: procedure.version,
                    })
                  }}
                </p>
              </BaseTableCell>
              <BaseTableCell>
                <span class="inline-flex flex-wrap gap-1.5">
                  <TierChip
                    v-for="channel in CHANNELS"
                    :key="channel"
                    :tier="tierOf(procedure, channel)"
                    :title="channelLabel(channel)"
                  />
                </span>
              </BaseTableCell>
              <BaseTableCell>{{ procedure.used }}</BaseTableCell>
              <BaseTableCell>{{ share(procedure.sentUnedited) }}</BaseTableCell>
              <BaseTableCell>
                <span
                  :class="
                    procedure.handedOver === 1
                      ? 'text-[var(--g-danger-text)]'
                      : ''
                  "
                >
                  {{ share(procedure.handedOver) }}
                </span>
              </BaseTableCell>
            </BaseTableRow>
          </template>
        </BaseTable>
        <p
          v-if="noMatchCount > 0"
          class="mb-0 text-sm text-[var(--g-text-muted)]"
          data-testid="overview-no-match"
        >
          {{ t(`${O}NO_MATCH`, { n: noMatchCount }, noMatchCount) }}
        </p>
      </section>
    </template>

    <template v-if="!isLoading && available && overview" #side>
      <h2 class="m-0 [font:var(--g-text-section)] text-[var(--g-text)]">
        {{ t(`${O}NEEDS_DECISION`) }}
      </h2>

      <div
        v-for="hold in holding"
        :key="hold.cycleId"
        class="flex flex-col gap-2 p-4 bg-[var(--g-surface)] border rounded-[var(--g-radius-card)] border-[var(--g-agent-border)]"
        :data-testid="`holding-${hold.cycleId}`"
      >
        <p class="mb-0 text-sm font-semibold text-[var(--g-text)]">
          {{ t(`${O}HOLDING_TITLE`, { s: secondsLeft(hold.firesAt, now) }) }}
        </p>
        <p class="mb-0 text-sm text-[var(--g-text-muted)]">
          {{ hold.procedureTitle }}
          <template v-if="hold.channel">
            · {{ channelLabel(hold.channel) }}
          </template>
        </p>
        <p
          v-if="outcome[hold.cycleId]"
          class="mb-0 text-sm text-[var(--g-text)]"
          :data-testid="`holding-outcome-${hold.cycleId}`"
        >
          {{ t(outcome[hold.cycleId].key) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <router-link
            :to="{
              name: 'inbox_conversation',
              params: { conversation_id: hold.conversationId },
            }"
            class="text-sm font-medium text-[var(--g-agent)] no-underline"
          >
            {{ t(`${O}REVIEW`) }}
          </router-link>
          <Button
            v-if="!outcome[hold.cycleId] || outcome[hold.cycleId].retry"
            :label="t(`${O}STOP`)"
            size="sm"
            variant="faded"
            color="ruby"
            :is-loading="stopping[hold.cycleId]"
            :data-testid="`holding-stop-${hold.cycleId}`"
            @click="stop(hold.cycleId)"
          />
        </div>
      </div>

      <template v-if="proposals.length">
        <h3 class="m-0 text-sm font-semibold text-[var(--g-text)]">
          {{ t(`${O}REMEMBER_TITLE`) }}
        </h3>
        <ProposalCard
          v-for="proposal in proposals"
          :key="proposal.id"
          :proposal="proposal"
          @decided="onProposalDecided"
        />
      </template>

      <p
        v-if="nothingToDecide"
        class="mb-0 text-sm text-[var(--g-text-muted)]"
        data-testid="overview-nothing"
      >
        {{ t(`${O}NOTHING`) }}
      </p>
    </template>
  </AgentPage>
</template>
