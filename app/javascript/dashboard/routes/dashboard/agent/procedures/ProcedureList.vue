<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMapGetter } from 'dashboard/composables/store';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { CHANNELS } from './procedureView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import ScopeChip from 'dashboard/components-next/gotchu/agent/ScopeChip.vue';
import TierChip from 'dashboard/components-next/gotchu/agent/TierChip.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import ReplayResult from './ReplayResult.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const currentRole = useMapGetter('getCurrentRole');
const isAdmin = computed(() => currentRole.value === 'administrator');
const { stores, inboxes, storeIndex, load: loadStores } = useGotchuStores();

const isLoading = ref(true);
const available = ref(true);
const errorKey = ref('');
const procedures = ref([]);

const replaying = reactive({});
const replayResult = ref(null);
const replayProcedure = ref(null);
const showReplayModal = ref(false);

const load = async () => {
  isLoading.value = true;
  errorKey.value = '';
  loadStores().catch(() => {});
  try {
    const { data } = await ProceduresAPI.list();
    available.value = data.capabilities?.procedures === true;
    procedures.value = data.procedures ?? [];
  } catch (error) {
    available.value = error?.response?.status !== 503;
    errorKey.value = gatewayErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

// The list carries `tiers` per channel (spec §11), so no per-row bindings
// read. A missing entry reads as Off, the same rule as `tierFor`.
const tierOf = (procedure, channel) => procedure.tiers?.[channel] ?? 'off';

const scopeOf = procedure => ({
  storeKey: procedure.storeKey ?? null,
  inboxId: null,
  exceptInboxIds: [],
});

// Replay is an administrator-only route, so only an administrator sees it.
const openReplay = async procedure => {
  replaying[procedure.id] = true;
  errorKey.value = '';
  try {
    const { data } = await ProceduresAPI.replay({ procedureId: procedure.id });
    replayResult.value = data;
    replayProcedure.value = procedure;
    showReplayModal.value = true;
  } catch (error) {
    errorKey.value = gatewayErrorKey(error);
  } finally {
    replaying[procedure.id] = false;
  }
};

const closeReplayModal = () => {
  showReplayModal.value = false;
};

const TH =
  'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.04em] text-[var(--g-text-muted)]';
const TD = 'px-3 py-3 align-middle border-t border-[var(--g-border)]';

onMounted(load);
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader
        :title="t('GOTCHU_AGENT.PROCEDURES.TITLE')"
        :lede="t('GOTCHU_AGENT.PROCEDURES.LEDE')"
      >
        <template #actions>
          <Button
            v-if="isAdmin && available"
            :label="t('GOTCHU_AGENT.PROCEDURES.NEW')"
            icon="i-lucide-plus"
            size="sm"
            data-testid="procedure-new"
            @click="
              router.push({ name: 'agent_procedure_new', params: route.params })
            "
          />
        </template>
      </GotchuPageHeader>
    </template>

    <AgentUnconfigured v-if="!isLoading && !available" />
    <template v-else>
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="procedures-error"
      >
        {{ t(errorKey) }}
      </p>
      <p
        v-else-if="!isLoading && !procedures.length"
        class="mb-0 text-sm text-[var(--g-text-muted)]"
      >
        {{ t('GOTCHU_AGENT.PROCEDURES.EMPTY') }}
      </p>
      <div
        v-if="procedures.length"
        class="overflow-x-auto bg-[var(--g-surface)] border border-[var(--g-border)] rounded-[var(--g-radius-card)]"
      >
        <table class="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th :class="TH">
                {{ t('GOTCHU_AGENT.PROCEDURES.COL_PROCEDURE') }}
              </th>
              <th :class="TH">{{ t('GOTCHU_AGENT.PROCEDURES.COL_TIERS') }}</th>
              <th :class="TH">{{ t('GOTCHU_AGENT.PROCEDURES.COL_STORE') }}</th>
              <th v-if="isAdmin" :class="TH" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="procedure in procedures"
              :key="procedure.id"
              :data-testid="`procedure-row-${procedure.id}`"
            >
              <td :class="TD">
                <router-link
                  :to="{
                    name: 'agent_procedure',
                    params: { ...route.params, procedureId: procedure.id },
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
              </td>
              <td :class="TD">
                <span class="inline-flex flex-wrap gap-1.5">
                  <TierChip
                    v-for="channel in CHANNELS"
                    :key="channel"
                    :tier="tierOf(procedure, channel)"
                    :title="t(`GOTCHU_AGENT.CHANNEL.${channel.toUpperCase()}`)"
                  />
                </span>
              </td>
              <td :class="TD">
                <ScopeChip
                  :scope="scopeOf(procedure)"
                  :stores="stores"
                  :inboxes="inboxes"
                  :store-index="storeIndex"
                />
              </td>
              <td v-if="isAdmin" :class="`${TD} text-right`">
                <Button
                  v-tooltip.top="t('GOTCHU_AGENT.PROCEDURES.REPLAY')"
                  icon="i-lucide-history"
                  size="xs"
                  variant="ghost"
                  color="slate"
                  :is-loading="replaying[procedure.id]"
                  :aria-label="t('GOTCHU_AGENT.PROCEDURES.REPLAY')"
                  :data-testid="`procedure-replay-${procedure.id}`"
                  @click="openReplay(procedure)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <woot-modal v-model:show="showReplayModal" :on-close="closeReplayModal">
      <div class="flex flex-col h-auto overflow-auto">
        <woot-modal-header
          :header-title="t('PROCEDURES_MGMT.REPLAY.TITLE')"
          :header-content="replayProcedure?.title"
        />
        <div class="flex flex-col gap-4 px-8 pb-8 mt-4">
          <ReplayResult
            v-if="replayResult && replayProcedure"
            :result="replayResult"
            :procedure-id="replayProcedure.id"
          />
          <div class="flex justify-end w-full gap-2 px-0 py-2">
            <Button
              faded
              slate
              :label="t('PROCEDURES_MGMT.REPLAY.CLOSE')"
              @click="closeReplayModal"
            />
          </div>
        </div>
      </div>
    </woot-modal>
  </AgentPage>
</template>
