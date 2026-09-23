<script setup>
import { computed, onBeforeMount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';
import { picoSearch } from '@chatwoot/pico-search';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { procedureErrorKey } from './errors';

import BaseSettingsHeader from '../components/BaseSettingsHeader.vue';
import SettingsLayout from '../SettingsLayout.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import UnconfiguredNotice from './UnconfiguredNotice.vue';
import ReplayResult from './ReplayResult.vue';
import {
  BaseTable,
  BaseTableRow,
  BaseTableCell,
} from 'dashboard/components-next/table';

const { t } = useI18n();

const STATUS_BADGE_CLASS = {
  testing: 'bg-n-slate-3 text-n-slate-11',
  active: 'bg-n-teal-3 text-n-teal-11',
  archived: 'bg-n-slate-3 text-n-slate-10',
};

const isLoading = ref(true);
const procedures = ref([]);
// Optimistic until the first read answers -- only a read that actually came
// back false should draw the unconfigured empty state.
const proceduresAvailable = ref(true);
const searchQuery = ref('');

// Keyed by procedure id, so one row's spinner never lights up another's.
const statusChanging = reactive({});
const replaying = reactive({});

const showReplayModal = ref(false);
const replayResult = ref(null);
const replayProcedure = ref(null);

const filteredRecords = computed(() => {
  const query = searchQuery.value.trim();
  if (!query) return procedures.value;
  return picoSearch(procedures.value, query, [
    { name: 'slug', weight: 4 },
    { name: 'title', weight: 2 },
  ]);
});

const tableHeaders = computed(() => [
  { label: t('PROCEDURES_MGMT.LIST.TABLE_HEADER.SLUG'), identifier: true },
  t('PROCEDURES_MGMT.LIST.TABLE_HEADER.TITLE'),
  t('PROCEDURES_MGMT.LIST.TABLE_HEADER.STORE'),
  t('PROCEDURES_MGMT.LIST.TABLE_HEADER.STATUS'),
  t('PROCEDURES_MGMT.LIST.TABLE_HEADER.TRIGGERS'),
  t('PROCEDURES_MGMT.LIST.TABLE_HEADER.ACTIONS'),
]);

const storeLabel = storeKey => storeKey || t('PROCEDURES_MGMT.LIST.GLOBAL');
const statusLabel = status =>
  t(`PROCEDURES_MGMT.STATUS.${status.toUpperCase()}`);
const statusBadgeClass = status =>
  STATUS_BADGE_CLASS[status] || STATUS_BADGE_CLASS.testing;

const fetchProcedures = async () => {
  isLoading.value = true;
  try {
    const { data } = await ProceduresAPI.list();
    procedures.value = data.procedures || [];
    proceduresAvailable.value = data.capabilities?.procedures === true;
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
  } finally {
    isLoading.value = false;
  }
};

const replaceProcedure = updated => {
  const idx = procedures.value.findIndex(p => p.id === updated.id);
  if (idx !== -1) {
    procedures.value.splice(idx, 1, { ...procedures.value[idx], ...updated });
  }
};

const changeStatus = async (procedure, status) => {
  statusChanging[procedure.id] = true;
  try {
    const { data } = await ProceduresAPI.changeStatus(procedure.id, status);
    replaceProcedure(data);
    useAlert(t('PROCEDURES_MGMT.STATUS.API.SUCCESS_MESSAGE'));
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
  } finally {
    statusChanging[procedure.id] = false;
  }
};

const openReplay = async procedure => {
  replaying[procedure.id] = true;
  try {
    const { data } = await ProceduresAPI.replay({ procedureId: procedure.id });
    replayResult.value = data;
    replayProcedure.value = procedure;
    showReplayModal.value = true;
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
  } finally {
    replaying[procedure.id] = false;
  }
};

const closeReplayModal = () => {
  showReplayModal.value = false;
};

onBeforeMount(fetchProcedures);
</script>

<template>
  <SettingsLayout
    :is-loading="isLoading"
    :loading-message="t('PROCEDURES_MGMT.LOADING')"
  >
    <template #header>
      <BaseSettingsHeader
        v-model:search-query="searchQuery"
        :title="t('PROCEDURES_MGMT.HEADER')"
        :description="t('PROCEDURES_MGMT.DESCRIPTION')"
        :search-placeholder="t('PROCEDURES_MGMT.SEARCH_PLACEHOLDER')"
      >
        <template v-if="procedures.length" #count>
          <span class="text-body-main text-n-slate-11">
            {{ t('PROCEDURES_MGMT.COUNT', { n: procedures.length }) }}
          </span>
        </template>
        <template v-if="proceduresAvailable" #actions>
          <router-link :to="{ name: 'procedures_new' }">
            <Button :label="t('PROCEDURES_MGMT.HEADER_BTN_TXT')" size="sm" />
          </router-link>
        </template>
      </BaseSettingsHeader>
    </template>
    <template #body>
      <UnconfiguredNotice v-if="!isLoading && !proceduresAvailable" />

      <BaseTable
        v-else
        :headers="tableHeaders"
        :items="filteredRecords"
        :no-data-message="
          searchQuery
            ? t('PROCEDURES_MGMT.NO_RESULTS')
            : t('PROCEDURES_MGMT.LIST.404')
        "
      >
        <template #row="{ items }">
          <BaseTableRow
            v-for="procedure in items"
            :key="procedure.id"
            :item="procedure"
          >
            <template #default>
              <BaseTableCell>
                <span class="text-body-main text-n-slate-12">
                  {{ procedure.slug }}
                </span>
              </BaseTableCell>

              <BaseTableCell>
                <span class="text-body-main text-n-slate-12">
                  {{ procedure.title }}
                </span>
              </BaseTableCell>

              <BaseTableCell>
                <span class="text-body-main text-n-slate-11">
                  {{ storeLabel(procedure.storeKey) }}
                </span>
              </BaseTableCell>

              <BaseTableCell>
                <span
                  class="inline-flex items-center h-6 px-2 rounded-md text-label-small"
                  :class="statusBadgeClass(procedure.status)"
                >
                  {{ statusLabel(procedure.status) }}
                </span>
              </BaseTableCell>

              <BaseTableCell>
                <span class="text-body-main text-n-slate-11">
                  {{ procedure.phrases?.length ?? 0 }}
                </span>
              </BaseTableCell>

              <BaseTableCell align="end">
                <div class="flex flex-wrap justify-end flex-shrink-0 gap-2">
                  <router-link
                    :to="{
                      name: 'procedures_edit',
                      params: { procedureId: procedure.id },
                    }"
                  >
                    <Button
                      v-tooltip.top="t('PROCEDURES_MGMT.ACTIONS.EDIT')"
                      icon="i-lucide-pencil"
                      slate
                      sm
                    />
                  </router-link>

                  <Button
                    v-if="procedure.status !== 'active'"
                    v-tooltip.top="t('PROCEDURES_MGMT.ACTIONS.ACTIVATE')"
                    icon="i-lucide-play"
                    slate
                    sm
                    :is-loading="statusChanging[procedure.id]"
                    :disabled="statusChanging[procedure.id]"
                    @click="changeStatus(procedure, 'active')"
                  />
                  <Button
                    v-if="procedure.status === 'active'"
                    v-tooltip.top="
                      t('PROCEDURES_MGMT.ACTIONS.RETURN_TO_TESTING')
                    "
                    icon="i-lucide-flask-conical"
                    slate
                    sm
                    :is-loading="statusChanging[procedure.id]"
                    :disabled="statusChanging[procedure.id]"
                    @click="changeStatus(procedure, 'testing')"
                  />
                  <Button
                    v-if="procedure.status !== 'archived'"
                    v-tooltip.top="t('PROCEDURES_MGMT.ACTIONS.ARCHIVE')"
                    icon="i-lucide-archive"
                    slate
                    sm
                    :is-loading="statusChanging[procedure.id]"
                    :disabled="statusChanging[procedure.id]"
                    @click="changeStatus(procedure, 'archived')"
                  />
                  <Button
                    v-tooltip.top="t('PROCEDURES_MGMT.ACTIONS.REPLAY')"
                    icon="i-lucide-refresh-cw"
                    slate
                    sm
                    :is-loading="replaying[procedure.id]"
                    :disabled="replaying[procedure.id]"
                    @click="openReplay(procedure)"
                  />
                </div>
              </BaseTableCell>
            </template>
          </BaseTableRow>
        </template>
      </BaseTable>
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
  </SettingsLayout>
</template>
