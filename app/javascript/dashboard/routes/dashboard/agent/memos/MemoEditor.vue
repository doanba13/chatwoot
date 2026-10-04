<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import MemosAPI from 'dashboard/api/gotchu/memos';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import { inboxOptions } from 'dashboard/components-next/gotchu/agent/scopeView';
import { memoBody } from './memoView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import { BRAND_BUTTON_CLASS } from 'dashboard/components-next/gotchu/agent/brandButton';
import Select from 'dashboard/components-next/select/Select.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';

// Board 8. Every agent may write a memo (agent-screens plan decision 1);
// what a memo may say is the gateway's save-time checks', shown under the
// text when it refuses.
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const { stores, inboxes, load: loadStores } = useGotchuStores();

const M = 'GOTCHU_AGENT.MEMO.';
const KINDS = ['standing_fact', 'style'];

const isNew = computed(() => route.name === 'agent_memo_new');
const memoId = computed(() => Number(route.params.memoId));

const isLoading = ref(true);
const unconfigured = ref(false);
const errorKey = ref('');
const checkMessages = ref([]);
const saving = ref(false);
const memo = ref(null);
const pendingInbox = ref(false);

const emptyForm = () => ({
  text: '',
  kind: 'standing_fact',
  scope: { storeKey: null, inboxId: null },
  until: '',
});
const form = ref(emptyForm());

const fail = error => {
  if (error?.response?.status === 503) unconfigured.value = true;
  if (error?.response?.status === 422) {
    checkMessages.value = (error.response.data?.checks ?? [])
      .filter(c => !c.ok)
      .map(c => c.message);
  }
  errorKey.value = gatewayErrorKey(error);
};

// There is no single-memo read: an edit finds its memo in the list.
const load = async () => {
  isLoading.value = true;
  errorKey.value = '';
  checkMessages.value = [];
  loadStores().catch(() => {});
  try {
    const { data } = await MemosAPI.list({ include: 'expired' });
    if (data.capabilities?.memos === false) {
      unconfigured.value = true;
      return;
    }
    if (isNew.value) {
      memo.value = null;
      form.value = emptyForm();
      return;
    }
    const found = (data.memos ?? []).find(m => m.id === memoId.value);
    if (!found) {
      errorKey.value = 'GOTCHU_AGENT.ERRORS.NOT_FOUND';
      return;
    }
    memo.value = found;
    form.value = {
      text: found.text,
      kind: found.kind,
      scope: {
        storeKey: found.scope?.storeKey ?? null,
        inboxId: found.scope?.inboxId ?? null,
      },
      until: found.expiresAt ? found.expiresAt.slice(0, 10) : '',
    };
  } catch (error) {
    fail(error);
  } finally {
    isLoading.value = false;
  }
};

// A 409 keeps the text: the banner says the memo changed underneath.
// "One inbox" chosen before an inbox is picked would save store-wide, which
// is not what was asked, so saving waits for the inbox.
const save = async () => {
  if (saving.value || !form.value.text.trim() || pendingInbox.value) return;
  saving.value = true;
  errorKey.value = '';
  checkMessages.value = [];
  try {
    if (isNew.value) {
      await MemosAPI.create(memoBody(form.value));
    } else {
      await MemosAPI.update(memo.value.id, memoBody(form.value));
    }
    router.push({ name: 'agent_memos' });
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
};

const remove = async () => {
  if (saving.value || !memo.value) return;
  saving.value = true;
  errorKey.value = '';
  try {
    await MemosAPI.remove(memo.value.id);
    router.push({ name: 'agent_memos' });
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
};

const setScope = scope => {
  form.value = { ...form.value, scope: { ...form.value.scope, ...scope } };
};
const scopeMode = computed(() => {
  if (form.value.scope.inboxId != null || pendingInbox.value) return 'inbox';
  if (form.value.scope.storeKey) return 'store';
  return 'all';
});
const setScopeMode = mode => {
  pendingInbox.value = mode === 'inbox' && form.value.scope.inboxId == null;
  if (mode === 'all') setScope({ storeKey: null, inboxId: null });
  else
    setScope({
      storeKey: form.value.scope.storeKey ?? stores.value[0]?.key ?? null,
      inboxId: mode === 'inbox' ? form.value.scope.inboxId : null,
    });
};
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
    setScope({ inboxId: id === '' ? null : Number(id) });
  },
});

const segment = active =>
  active
    ? 'bg-[var(--g-surface)] text-[var(--g-text)] shadow-sm'
    : 'text-[var(--g-text-muted)]';

const headerTitle = computed(() =>
  isNew.value ? t(`${M}NEW`) : t(`${M}EDIT_TITLE`)
);
const crumbs = computed(() => [
  { label: t(`${M}LIST_TITLE`), to: { name: 'agent_memos' } },
  { label: headerTitle.value },
]);
const H2 = 'm-0 text-sm font-semibold text-[var(--g-text)]';

onMounted(load);
watch(() => [route.name, route.params.memoId], load);
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader :title="headerTitle" :crumbs="crumbs" />
    </template>

    <AgentUnconfigured v-if="unconfigured" />
    <div v-else-if="!isLoading" class="flex flex-col gap-6 max-w-[720px]">
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="memo-error"
      >
        {{ t(errorKey) }}
      </p>

      <section class="flex flex-col gap-2">
        <h2 :class="H2">{{ t(`${M}TEXT`) }}</h2>
        <TextArea
          v-model="form.text"
          :max-length="600"
          show-character-count
          auto-height
          min-height="6rem"
          data-testid="memo-text"
        />
        <ul
          v-if="checkMessages.length"
          class="flex flex-col gap-1 p-0 m-0 list-none text-sm text-[var(--g-danger-text)]"
          data-testid="memo-checks"
        >
          <li v-for="message in checkMessages" :key="message">
            {{ message }}
          </li>
        </ul>
      </section>

      <section class="flex flex-col gap-2">
        <h2 :class="H2">{{ t(`${M}COL_KIND`) }}</h2>
        <div
          class="inline-flex self-start p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
          role="group"
        >
          <button
            v-for="kind in KINDS"
            :key="kind"
            type="button"
            class="px-3 py-1 text-sm font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)]"
            :class="segment(form.kind === kind)"
            :aria-pressed="form.kind === kind"
            :data-testid="`memo-kind-${kind}`"
            @click="form = { ...form, kind }"
          >
            {{ t(`${M}KIND.${kind.toUpperCase()}`) }}
          </button>
        </div>
      </section>

      <section class="flex flex-col gap-2">
        <h2 :class="H2">{{ t(`${M}COL_SCOPE`) }}</h2>
        <div
          class="inline-flex self-start p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
          role="group"
        >
          <button
            v-for="mode in ['all', 'store', 'inbox']"
            :key="mode"
            type="button"
            class="px-3 py-1 text-sm font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)] disabled:cursor-not-allowed"
            :class="segment(scopeMode === mode)"
            :disabled="mode !== 'all' && !stores.length"
            :data-testid="`memo-scope-${mode}`"
            @click="setScopeMode(mode)"
          >
            {{
              mode === 'all'
                ? t('GOTCHU_AGENT.SCOPE.ALL_STORES')
                : mode === 'store'
                  ? t('GOTCHU_AGENT.RULE.ONE_STORE')
                  : t('GOTCHU_AGENT.RULE.ONE_INBOX')
            }}
          </button>
        </div>
        <div v-if="scopeMode !== 'all'" class="flex flex-wrap gap-2">
          <Select
            v-model="storeKeyModel"
            :options="storeOptions"
            :aria-label="t('GOTCHU_AGENT.RULE.ONE_STORE')"
          />
          <Select
            v-if="scopeMode === 'inbox'"
            v-model="inboxIdModel"
            :options="scopeInboxOptions"
            :placeholder="t('GOTCHU_AGENT.RULE.ONE_INBOX')"
            :aria-label="t('GOTCHU_AGENT.RULE.ONE_INBOX')"
          />
        </div>
        <p v-if="pendingInbox" class="mb-0 text-xs text-[var(--g-text-muted)]">
          {{ t('GOTCHU_AGENT.RULE.PROBLEM_PICK_INBOX') }}
        </p>
      </section>

      <section class="flex flex-col gap-2">
        <h2 :class="H2">
          {{ t(`${M}UNTIL`) }}
          <span class="font-normal text-[var(--g-text-muted)]">
            {{ t(`${M}OPTIONAL`) }}
          </span>
        </h2>
        <input
          v-model="form.until"
          type="date"
          class="self-start h-10 px-3 text-sm border rounded-[var(--g-radius-control)] border-[var(--g-border)] bg-[var(--g-surface)] text-[var(--g-text)]"
          data-testid="memo-until"
        />
      </section>

      <div class="flex flex-col gap-3 pt-4 border-t border-[var(--g-border)]">
        <p class="mb-0 text-sm text-[var(--g-text-muted)]">
          {{ t(`${M}REFUSAL_HINT`) }}
        </p>
        <div class="flex flex-wrap gap-2">
          <Button
            v-if="memo"
            :label="t(`${M}REMOVE`)"
            size="sm"
            variant="faded"
            color="ruby"
            :disabled="saving"
            data-testid="memo-remove"
            @click="remove"
          />
          <Button
            :label="t(`${M}CANCEL`)"
            size="sm"
            variant="ghost"
            color="slate"
            data-testid="memo-cancel"
            @click="router.push({ name: 'agent_memos' })"
          />
          <Button
            :label="t(`${M}SAVE`)"
            size="sm"
            color="slate"
            no-animation
            :class="BRAND_BUTTON_CLASS"
            :is-loading="saving"
            :disabled="!form.text.trim() || pendingInbox"
            data-testid="memo-save"
            @click="save"
          />
        </div>
      </div>
    </div>
  </AgentPage>
</template>
