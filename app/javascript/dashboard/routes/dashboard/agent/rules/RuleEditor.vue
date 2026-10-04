<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useDebounceFn } from '@vueuse/core';
import { useAlert } from 'dashboard/composables';
import { useMapGetter } from 'dashboard/composables/store';

import RulesAPI from 'dashboard/api/gotchu/rules';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { inboxOptions } from 'dashboard/components-next/gotchu/agent/scopeView';
import { emptyForm, formFromRule, toBody, localProblems } from './ruleForm';
import { channelWord, demotedTitle, sendingKey } from './ruleView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import StatusPill from 'dashboard/components-next/gotchu/agent/StatusPill.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import Select from 'dashboard/components-next/select/Select.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import ConditionRow from './ConditionRow.vue';
import ChecksPanel from './ChecksPanel.vue';

const { t, te } = useI18n();
const route = useRoute();
const router = useRouter();
const currentRole = useMapGetter('getCurrentRole');
// Writes, the save-time check and the replay are administrator-only routes:
// an agent reads the rule and is never offered a control that would 401.
const readOnly = computed(() => currentRole.value !== 'administrator');
const { stores, inboxes, load: loadStores } = useGotchuStores();

const R = 'GOTCHU_AGENT.RULE.';
const SENDINGS = ['no_change', 'never_auto', 'hand_over'];

const isNew = computed(() => route.name === 'agent_rule_new');
const ruleId = computed(() => Number(route.params.ruleId));

const isLoading = ref(true);
const unconfigured = ref(false);
const errorKey = ref('');
const rule = ref(null);
const facts = ref([]);
const form = ref(emptyForm());
const serverChecks = ref([]);
const overlaps = ref([]);
const replay = ref(null);
const saving = ref(false);
const testing = ref(false);
const exceptPick = ref('');

// "One inbox" chosen before an inbox is picked. Until one is, the rule would
// save store-wide, which is not what was asked, so saving waits.
const pendingInbox = ref(false);

const problems = computed(() => [
  ...localProblems(form.value, facts.value),
  ...(pendingInbox.value ? [`${R}PROBLEM_PICK_INBOX`] : []),
]);
// Spec §14: the overlap warning belongs to a rule that adds text and leaves
// sending alone; a rule that holds sending back demotes nothing.
const shownOverlaps = computed(() =>
  form.value.say.trim() && form.value.sending === 'no_change'
    ? overlaps.value
    : []
);

const fail = error => {
  if (error?.response?.status === 503) unconfigured.value = true;
  errorKey.value = gatewayErrorKey(error);
};

const applyRule = data => {
  rule.value = data;
  form.value = formFromRule(data);
};

const load = async () => {
  isLoading.value = true;
  errorKey.value = '';
  loadStores().catch(() => {});
  try {
    const { data } = await RulesAPI.list({ status: 'active' });
    if (data.capabilities?.rules === false) {
      unconfigured.value = true;
      return;
    }
    facts.value = data.facts ?? [];
    if (isNew.value) {
      rule.value = null;
      form.value = emptyForm();
    } else {
      const { data: shown } = await RulesAPI.show(ruleId.value);
      applyRule(shown);
    }
  } catch (error) {
    fail(error);
  } finally {
    isLoading.value = false;
  }
};

// Live checks while an administrator edits: debounced, and only once the
// page's own problems are gone, so the gateway is never asked about a form
// the page already knows is incomplete.
const runCheck = useDebounceFn(async () => {
  if (readOnly.value || problems.value.length) return;
  try {
    const { data } = await RulesAPI.check(toBody(form.value));
    serverChecks.value = data.checks ?? [];
    overlaps.value = data.overlaps ?? [];
  } catch (error) {
    if (error?.response?.status === 422) {
      serverChecks.value = error.response.data?.checks ?? [];
    }
  }
}, 600);

watch(
  form,
  () => {
    if (!isLoading.value) runCheck();
  },
  { deep: true }
);

const alertDemoted = demoted =>
  (demoted ?? []).forEach(d =>
    useAlert(
      t(`${R}DEMOTED`, {
        title: demotedTitle(d),
        channel: channelWord(d.channel, t, te),
      })
    )
  );

// A 409 keeps the form: the user's text stays, and the banner says the rule
// changed underneath them. A 422 puts the gateway's checks in the panel.
const save = async () => {
  if (readOnly.value || saving.value || problems.value.length) return;
  saving.value = true;
  errorKey.value = '';
  try {
    if (isNew.value) {
      const { data } = await RulesAPI.create(toBody(form.value));
      router.replace({ name: 'agent_rule', params: { ruleId: data.id } });
      return;
    }
    const { data } = await RulesAPI.revise(
      rule.value.id,
      toBody(form.value),
      rule.value.version
    );
    applyRule(data.rule);
    alertDemoted(data.demoted);
  } catch (error) {
    if (error?.response?.status === 422) {
      serverChecks.value = error.response.data?.checks ?? [];
    }
    fail(error);
  } finally {
    saving.value = false;
  }
};

const setStatus = async status => {
  if (readOnly.value || !rule.value) return;
  errorKey.value = '';
  try {
    const { data } = await RulesAPI.setStatus(
      rule.value.id,
      status,
      rule.value.version
    );
    applyRule(data.rule);
    alertDemoted(data.demoted);
  } catch (error) {
    fail(error);
  }
};

const runReplay = async () => {
  if (readOnly.value || testing.value) return;
  testing.value = true;
  errorKey.value = '';
  try {
    const { data } = await RulesAPI.replay(toBody(form.value), {
      ruleId: rule.value?.id,
    });
    replay.value = data;
  } catch (error) {
    fail(error);
  } finally {
    testing.value = false;
  }
};

const addCondition = () => {
  form.value = {
    ...form.value,
    conditions: [...form.value.conditions, { fact: '', op: '', value: [] }],
  };
};

const removeCondition = index => {
  form.value = {
    ...form.value,
    conditions: form.value.conditions.filter((_, i) => i !== index),
  };
};

const usesOrderCount = computed(() =>
  form.value.conditions.some(c => c.fact === 'customer_order_count')
);

// Applies to: all stores, one store, or one inbox under a store (spec §3).
const scopeMode = computed(() => {
  if (form.value.scope.inboxId != null) return 'inbox';
  if (form.value.scope.storeKey) return 'store';
  return 'all';
});
const setScope = scope => {
  form.value = { ...form.value, scope: { ...form.value.scope, ...scope } };
};
const setScopeMode = mode => {
  pendingInbox.value = false;
  if (mode === 'all') setScope({ storeKey: null, inboxId: null });
  if (mode === 'store' || mode === 'inbox') {
    setScope({
      storeKey: form.value.scope.storeKey ?? stores.value[0]?.key ?? null,
      inboxId: null,
    });
  }
  if (mode === 'inbox') pendingInbox.value = true;
};
const showInboxPicker = computed(
  () => scopeMode.value === 'inbox' || pendingInbox.value
);

const storeOptions = computed(() =>
  stores.value.map(s => ({ value: s.key, label: s.name }))
);
const storeKeyModel = computed({
  get: () => form.value.scope.storeKey ?? '',
  set: key => setScope({ storeKey: key || null, inboxId: null }),
});
const scopeInboxOptions = computed(() =>
  inboxOptions(form.value.scope.storeKey, {
    stores: stores.value,
    inboxes: inboxes.value,
  }).map(o => ({
    value: o.value,
    label: o.shared
      ? `${o.label} · ${t('GOTCHU_AGENT.SCOPE.SHARED_SUFFIX')}`
      : o.label,
  }))
);
const inboxIdModel = computed({
  get: () => form.value.scope.inboxId ?? '',
  set: id => {
    pendingInbox.value = false;
    setScope({ inboxId: id === '' ? null : Number(id), exceptInboxIds: [] });
  },
});

// The Except picker is offered only while no single inbox is chosen.
const exceptOptions = computed(() => {
  const pool = form.value.scope.storeKey
    ? scopeInboxOptions.value
    : inboxes.value.map(i => ({ value: i.id, label: `${i.name} #${i.id}` }));
  return pool.filter(o => !form.value.scope.exceptInboxIds.includes(o.value));
});
const exceptLabel = id =>
  inboxes.value.find(i => i.id === id)?.name
    ? `${inboxes.value.find(i => i.id === id).name} #${id}`
    : `#${id}`;
const addExcept = id => {
  if (id === '' || id == null) return;
  setScope({
    exceptInboxIds: [...form.value.scope.exceptInboxIds, Number(id)],
  });
  exceptPick.value = '';
};
const removeExcept = id =>
  setScope({
    exceptInboxIds: form.value.scope.exceptInboxIds.filter(x => x !== id),
  });
watch(exceptPick, addExcept);

const segment = active =>
  active
    ? 'bg-[var(--g-surface)] text-[var(--g-text)] shadow-sm'
    : 'text-[var(--g-text-muted)]';

const nextVersion = computed(() => (rule.value?.version ?? 0) + 1);
const headerTitle = computed(() =>
  isNew.value ? t(`${R}NEW`) : rule.value?.title || t(`${R}LIST_TITLE`)
);
const crumbs = computed(() => [
  { label: t(`${R}LIST_TITLE`), to: { name: 'agent_rules' } },
  { label: headerTitle.value },
]);

const H2 = 'm-0 [font:var(--g-text-section)] text-[var(--g-text)]';

onMounted(load);
watch(() => [route.name, route.params.ruleId], load);
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader :title="headerTitle" :crumbs="crumbs">
        <template #pill>
          <StatusPill
            v-if="rule"
            :status="rule.status"
            :version="rule.version"
          />
          <span
            v-if="rule?.status === 'testing'"
            class="text-xs text-[var(--g-text-muted)]"
          >
            {{ t(`${R}TESTING_NOTE`) }}
          </span>
          <template v-if="rule && !readOnly">
            <Button
              v-if="rule.status !== 'active'"
              :label="t(`${R}ACTIVATE`)"
              size="sm"
              variant="link"
              data-testid="rule-activate"
              @click="setStatus('active')"
            />
            <Button
              v-if="rule.status === 'active'"
              :label="t(`${R}DEACTIVATE`)"
              size="sm"
              variant="link"
              data-testid="rule-deactivate"
              @click="setStatus('testing')"
            />
            <Button
              v-if="rule.status !== 'archived'"
              :label="t(`${R}ARCHIVE`)"
              size="sm"
              variant="link"
              color="slate"
              data-testid="rule-archive"
              @click="setStatus('archived')"
            />
          </template>
        </template>
        <template #actions>
          <Button
            :label="t('GOTCHU_AGENT.CANCEL')"
            size="sm"
            variant="ghost"
            color="slate"
            data-testid="rule-cancel"
            @click="router.push({ name: 'agent_rules' })"
          />
        </template>
      </GotchuPageHeader>
    </template>

    <AgentUnconfigured v-if="unconfigured" />
    <template v-else-if="!isLoading">
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="rule-error"
      >
        {{ t(errorKey) }}
      </p>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <Input
          v-model="form.title"
          :label="t(`${R}NAME`)"
          :disabled="readOnly"
          data-testid="rule-title"
        />

        <section class="flex flex-col gap-3">
          <h2 :class="H2">{{ t(`${R}WHEN`) }}</h2>
          <template v-for="(_, i) in form.conditions" :key="i">
            <p
              v-if="i > 0"
              class="mb-0 text-xs font-semibold uppercase text-[var(--g-text-muted)]"
            >
              {{ t(`${R}AND`) }}
            </p>
            <ConditionRow
              v-model="form.conditions[i]"
              :facts="facts"
              :sending="form.sending"
              :read-only="readOnly"
              @remove="removeCondition(i)"
            />
          </template>
          <button
            v-if="!readOnly"
            type="button"
            class="self-start px-0 text-sm font-medium border-0 bg-transparent text-[var(--g-agent)]"
            data-testid="rule-add-condition"
            @click="addCondition"
          >
            {{ t(`${R}ADD_CONDITION`) }}
          </button>
          <p
            v-if="usesOrderCount"
            class="mb-0 text-xs text-[var(--g-text-muted)]"
          >
            {{ t(`${R}ORDERS_NOTE`) }}
          </p>
        </section>

        <section class="flex flex-col gap-2">
          <h2 :class="H2">{{ t(`${R}COL_SENDING`) }}</h2>
          <div
            class="inline-flex self-start p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
            role="group"
          >
            <button
              v-for="sending in SENDINGS"
              :key="sending"
              type="button"
              class="px-3 py-1 text-sm font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)] disabled:cursor-not-allowed"
              :class="segment(form.sending === sending)"
              :aria-pressed="form.sending === sending"
              :disabled="readOnly"
              :data-testid="`rule-sending-${sending}`"
              @click="form = { ...form, sending }"
            >
              {{ t(sendingKey(sending)) }}
            </button>
          </div>
          <p class="mb-0 text-xs text-[var(--g-text-muted)]">
            {{ t(`${R}SENDING_HINT`) }}
          </p>
        </section>

        <section class="flex flex-col gap-2">
          <h2 :class="H2">{{ t(`${R}SAY`) }}</h2>
          <TextArea
            v-model="form.say"
            :max-length="600"
            show-character-count
            auto-height
            min-height="6rem"
            :disabled="readOnly"
            :placeholder="t(`${R}SAY_HINT`)"
            data-testid="rule-say"
          />
        </section>

        <section class="flex flex-col gap-3">
          <h2 :class="H2">{{ t(`${R}APPLIES_TO`) }}</h2>
          <div
            class="inline-flex self-start p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
            role="group"
          >
            <button
              v-for="mode in ['all', 'store', 'inbox']"
              :key="mode"
              type="button"
              class="px-3 py-1 text-sm font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)] disabled:cursor-not-allowed"
              :class="
                segment(
                  mode === 'inbox'
                    ? showInboxPicker
                    : scopeMode === mode && !pendingInbox
                )
              "
              :disabled="readOnly || (mode !== 'all' && !stores.length)"
              :data-testid="`rule-scope-${mode}`"
              @click="setScopeMode(mode)"
            >
              {{
                mode === 'all'
                  ? t('GOTCHU_AGENT.SCOPE.ALL_STORES')
                  : mode === 'store'
                    ? t(`${R}ONE_STORE`)
                    : t(`${R}ONE_INBOX`)
              }}
            </button>
          </div>
          <div
            v-if="scopeMode !== 'all' || pendingInbox"
            class="flex flex-wrap gap-2"
          >
            <Select
              v-model="storeKeyModel"
              :options="storeOptions"
              :disabled="readOnly"
              :aria-label="t(`${R}ONE_STORE`)"
            />
            <Select
              v-if="showInboxPicker"
              v-model="inboxIdModel"
              :options="scopeInboxOptions"
              :placeholder="t(`${R}ONE_INBOX`)"
              :disabled="readOnly"
              :aria-label="t(`${R}ONE_INBOX`)"
            />
          </div>
          <div
            v-if="!showInboxPicker"
            class="flex flex-wrap items-center gap-2 text-sm"
          >
            <span class="text-[var(--g-text-muted)]">{{
              t(`${R}EXCEPT`)
            }}</span>
            <span
              v-for="id in form.scope.exceptInboxIds"
              :key="id"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--g-radius-tag)] bg-[var(--g-surface-inbox)] text-[var(--g-text)]"
            >
              {{ exceptLabel(id) }}
              <button
                v-if="!readOnly"
                type="button"
                class="p-0 border-0 bg-transparent i-lucide-x size-3.5 text-[var(--g-text-muted)]"
                :aria-label="t(`${R}REMOVE_EXCEPT`)"
                @click="removeExcept(id)"
              />
            </span>
            <Select
              v-if="!readOnly && exceptOptions.length"
              v-model="exceptPick"
              :options="exceptOptions"
              :placeholder="t(`${R}SWITCH_OFF_INBOX`)"
              :aria-label="t(`${R}SWITCH_OFF_INBOX`)"
            />
          </div>
        </section>

        <div v-if="!readOnly" class="flex flex-wrap gap-2">
          <Button
            :label="t(`${R}TEST`)"
            size="sm"
            color="slate"
            :is-loading="testing"
            :disabled="problems.length > 0"
            data-testid="rule-test"
            @click="runReplay"
          />
          <Button
            :label="
              isNew
                ? t(`${R}SAVE_TESTING`)
                : t('GOTCHU_AGENT.PROCEDURE.SAVE_AS', { version: nextVersion })
            "
            size="sm"
            color="slate"
            :is-loading="saving"
            :disabled="problems.length > 0"
            data-testid="rule-save"
            @click="save"
          />
        </div>
      </div>
    </template>

    <template v-if="!unconfigured && !isLoading" #side>
      <ChecksPanel
        :checks="serverChecks"
        :overlaps="shownOverlaps"
        :replay="replay"
        :local-problems="readOnly ? [] : problems"
      />
    </template>
  </AgentPage>
</template>
