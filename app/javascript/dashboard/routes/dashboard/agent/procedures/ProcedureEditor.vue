<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useMapGetter } from 'dashboard/composables/store';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { useGotchuStores } from 'dashboard/components-next/gotchu/agent/useGotchuStores';
import {
  MAX_BODY_LENGTH,
  slugError,
  titleError,
  bodyError,
  phrasesError,
  isProcedureFormValid,
} from './validations';
import {
  replayMatchCount,
  replayIsPartial,
  replayScopeView,
} from './replayView';

import AgentPage from 'dashboard/components-next/gotchu/agent/AgentPage.vue';
import AgentUnconfigured from 'dashboard/components-next/gotchu/agent/AgentUnconfigured.vue';
import GotchuPageHeader from 'dashboard/components-next/gotchu/agent/GotchuPageHeader.vue';
import NotBuiltChip from 'dashboard/components-next/gotchu/agent/NotBuiltChip.vue';
import StatusPill from 'dashboard/components-next/gotchu/agent/StatusPill.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import ProcedureTiers from './ProcedureTiers.vue';
import HistoryPanel from './HistoryPanel.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const currentRole = useMapGetter('getCurrentRole');
const isAdmin = computed(() => currentRole.value === 'administrator');
const readOnly = computed(() => !isAdmin.value);

const { stores, load: loadStores } = useGotchuStores();

const isNew = computed(() => route.name === 'agent_procedure_new');
const procedureId = computed(() => Number(route.params.procedureId));

const isLoading = ref(false);
const unconfigured = ref(false);
const errorKey = ref('');
const procedure = ref(null);
const replay = ref(null);
const revisions = ref([]);
const history = ref(null);
const saving = ref(false);
const replaying = ref(false);
const submitted = ref(false);
const editing = ref(false);
const newPhrase = ref('');
const addingPhrase = ref(false);

const form = ref({ title: '', phrases: [], body: '', slug: '', storeKey: '' });

const applyProcedure = data => {
  procedure.value = data;
  form.value = {
    title: data.title ?? '',
    phrases: [...(data.phrases ?? [])],
    body: data.body ?? '',
    slug: data.slug ?? '',
    storeKey: data.storeKey ?? '',
  };
};

const fail = error => {
  if (error?.response?.status === 503) unconfigured.value = true;
  errorKey.value = gatewayErrorKey(error);
};

const loadReplay = async () => {
  const { data } = await ProceduresAPI.replayLatest(procedureId.value);
  replay.value = data.result;
};

const reset = () => {
  procedure.value = null;
  replay.value = null;
  errorKey.value = '';
  unconfigured.value = false;
  submitted.value = false;
  editing.value = false;
  form.value = { title: '', phrases: [], body: '', slug: '', storeKey: '' };
};

const load = async () => {
  reset();
  loadStores().catch(() => {});
  if (isNew.value) {
    editing.value = true;
    return;
  }
  isLoading.value = true;
  try {
    const { data } = await ProceduresAPI.show(procedureId.value);
    applyProcedure(data);
    await loadReplay();
  } catch (error) {
    fail(error);
  } finally {
    isLoading.value = false;
  }
};

// The slug is identity: asked for on a new procedure only, never sent on a
// revision (the controller carries the existing slug over regardless).
const formErrors = computed(() => ({
  slug: isNew.value ? slugError(form.value.slug) : '',
  title: titleError(form.value.title),
  body: bodyError(form.value.body),
  phrases: phrasesError(form.value.phrases),
}));

const formValid = computed(() =>
  isProcedureFormValid({
    ...(isNew.value ? { slug: form.value.slug } : {}),
    title: form.value.title,
    body: form.value.body,
    phrases: form.value.phrases,
  })
);

const nextVersion = computed(() => (procedure.value?.version ?? 0) + 1);

// A 409 keeps the form untouched: the user's text stays where it is, and the
// banner says the procedure changed underneath them.
const save = async () => {
  submitted.value = true;
  if (!formValid.value || saving.value) return;
  saving.value = true;
  errorKey.value = '';
  const { title, body, phrases, slug, storeKey } = form.value;
  try {
    if (isNew.value) {
      const { data } = await ProceduresAPI.create({
        slug: slug.trim(),
        title: title.trim(),
        body,
        phrases,
        store_key: storeKey || null,
      });
      router.replace({
        name: 'agent_procedure',
        params: { ...route.params, procedureId: data.id },
      });
      return;
    }
    const { data } = await ProceduresAPI.update(procedure.value.id, {
      title: title.trim(),
      body,
      phrases,
    });
    applyProcedure({ ...procedure.value, ...data });
    editing.value = false;
    submitted.value = false;
  } catch (error) {
    fail(error);
  } finally {
    saving.value = false;
  }
};

const runReplay = async () => {
  if (replaying.value) return;
  replaying.value = true;
  errorKey.value = '';
  try {
    await ProceduresAPI.replay({ days: 30, procedureId: procedure.value.id });
    await loadReplay();
  } catch (error) {
    fail(error);
  } finally {
    replaying.value = false;
  }
};

const changeStatus = async status => {
  errorKey.value = '';
  try {
    const { data } = await ProceduresAPI.changeStatus(
      procedure.value.id,
      status
    );
    procedure.value = { ...procedure.value, ...data };
  } catch (error) {
    fail(error);
  }
};

const openHistory = async () => {
  errorKey.value = '';
  try {
    const { data } = await ProceduresAPI.revisions(procedure.value.id);
    revisions.value = data.revisions ?? [];
    history.value?.open();
  } catch (error) {
    fail(error);
  }
};

const addPhrase = () => {
  const phrase = newPhrase.value.trim();
  if (phrase && !form.value.phrases.includes(phrase)) {
    form.value = { ...form.value, phrases: [...form.value.phrases, phrase] };
  }
  newPhrase.value = '';
  addingPhrase.value = false;
};

const removePhrase = phrase => {
  form.value = {
    ...form.value,
    phrases: form.value.phrases.filter(p => p !== phrase),
  };
};

// Preview only: a paragraph whose first line reads like "If …:" (or its
// German and French equivalents) renders as an indented branch block. The
// stored body is never changed by the preview.
const BRANCH = /^(if|wenn|si)\b.*:$/i;
const blocks = computed(() =>
  form.value.body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(paragraph => {
      const [first, ...rest] = paragraph.split('\n');
      return BRANCH.test(first.trim())
        ? { branch: true, label: first.trim(), text: rest.join('\n') }
        : { branch: false, text: paragraph };
    })
);

const offersGoodwill = computed(() =>
  (procedure.value?.mayOffer ?? []).includes('goodwill_code')
);

const replayLines = computed(() => {
  const result = replay.value;
  if (!result) return null;
  return {
    matched: replayMatchCount(result, procedure.value.id),
    considered: result.considered,
    ambiguous: result.byResolution?.ambiguous ?? 0,
    capped: result.cappedByWindow ? replayScopeView(result) : null,
    partial: replayIsPartial(result),
  };
});

const headerTitle = computed(() =>
  isNew.value
    ? t('GOTCHU_AGENT.PROCEDURE.NEW_TITLE')
    : procedure.value?.title || t('GOTCHU_AGENT.PROCEDURE.LIST_CRUMB')
);

const crumbs = computed(() => [
  {
    label: t('GOTCHU_AGENT.PROCEDURE.LIST_CRUMB'),
    to: { name: 'agent_procedures', params: route.params },
  },
  { label: headerTitle.value },
]);

const showError = field =>
  submitted.value && formErrors.value[field] ? formErrors.value[field] : '';

const CARD =
  'flex flex-col gap-3 bg-[var(--g-surface)] border border-[var(--g-border)] rounded-[var(--g-radius-card)] p-[18px]';

onMounted(load);
// Create replaces the route with the new procedure's; both routes render this
// component, so the instance is reused and has to read again itself.
watch(() => [route.name, route.params.procedureId], load);
</script>

<template>
  <AgentPage>
    <template #header>
      <GotchuPageHeader :title="headerTitle" :crumbs="crumbs">
        <template #pill>
          <StatusPill
            v-if="procedure"
            :status="procedure.status"
            :version="procedure.version"
          />
          <template v-if="procedure && isAdmin">
            <Button
              v-if="procedure.status !== 'active'"
              :label="t('GOTCHU_AGENT.PROCEDURE.ACTIVATE')"
              size="sm"
              variant="link"
              data-testid="procedure-activate"
              @click="changeStatus('active')"
            />
            <Button
              v-if="procedure.status === 'active'"
              :label="t('GOTCHU_AGENT.PROCEDURE.DEACTIVATE')"
              size="sm"
              variant="link"
              data-testid="procedure-deactivate"
              @click="changeStatus('testing')"
            />
            <Button
              v-if="procedure.status !== 'archived'"
              :label="t('GOTCHU_AGENT.PROCEDURE.ARCHIVE')"
              size="sm"
              variant="link"
              color="slate"
              data-testid="procedure-archive"
              @click="changeStatus('archived')"
            />
          </template>
        </template>
        <template #actions>
          <Button
            v-if="procedure"
            :label="t('GOTCHU_AGENT.PROCEDURE.HISTORY')"
            size="sm"
            variant="faded"
            color="slate"
            data-testid="procedure-history"
            @click="openHistory"
          />
          <Button
            v-if="procedure && isAdmin"
            :label="t('GOTCHU_AGENT.PROCEDURE.REPLAY_30')"
            size="sm"
            variant="faded"
            color="slate"
            :is-loading="replaying"
            data-testid="procedure-replay"
            @click="runReplay"
          />
          <Button
            v-if="isAdmin && (isNew || procedure)"
            :label="
              t('GOTCHU_AGENT.PROCEDURE.SAVE_AS', { version: nextVersion })
            "
            size="sm"
            :is-loading="saving"
            data-testid="procedure-save"
            @click="save"
          />
        </template>
      </GotchuPageHeader>
    </template>

    <AgentUnconfigured v-if="unconfigured" />
    <template v-else>
      <p
        v-if="errorKey"
        class="mb-0 text-sm text-[var(--g-danger-text)]"
        data-testid="procedure-error"
      >
        {{ t(errorKey) }}
      </p>

      <div v-if="isNew || procedure" class="flex flex-col gap-6 max-w-[720px]">
        <div v-if="editing" class="flex flex-col gap-3">
          <Input
            v-model="form.title"
            :label="t('PROCEDURES_MGMT.FORM.TITLE.LABEL')"
            :message="showError('title') ? t(showError('title')) : ''"
            :message-type="showError('title') ? 'error' : 'info'"
            :disabled="readOnly"
            data-testid="procedure-title"
          />
          <template v-if="isNew">
            <Input
              v-model="form.slug"
              :label="t('GOTCHU_AGENT.PROCEDURE.SLUG')"
              :message="
                showError('slug')
                  ? t(showError('slug'))
                  : t('GOTCHU_AGENT.PROCEDURE.SLUG_HINT')
              "
              :message-type="showError('slug') ? 'error' : 'info'"
              :disabled="readOnly"
              data-testid="procedure-slug"
            />
            <label class="flex flex-col gap-1 text-sm text-[var(--g-text)]">
              {{ t('PROCEDURES_MGMT.FORM.STORE.LABEL') }}
              <select
                v-model="form.storeKey"
                :disabled="readOnly"
                class="px-3 py-2 text-sm border rounded-[var(--g-radius-control)] border-[var(--g-border)] bg-[var(--g-surface)] text-[var(--g-text)]"
                data-testid="procedure-store"
              >
                <option value="">
                  {{ t('GOTCHU_AGENT.SCOPE.ALL_STORES') }}
                </option>
                <option
                  v-for="store in stores"
                  :key="store.key"
                  :value="store.key"
                >
                  {{ store.name }}
                </option>
              </select>
            </label>
          </template>
        </div>

        <section class="flex flex-col gap-3">
          <h2 class="m-0 [font:var(--g-text-section)] text-[var(--g-text)]">
            {{ t('GOTCHU_AGENT.PROCEDURE.WHEN') }}
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            <span
              v-for="phrase in form.phrases"
              :key="phrase"
              class="inline-flex items-center gap-1.5 px-3 py-1 text-sm rounded-full bg-[var(--g-surface)] border border-[var(--g-border)] text-[var(--g-text)]"
            >
              {{ phrase }}
              <button
                v-if="!readOnly"
                type="button"
                class="p-0 border-0 bg-transparent text-[var(--g-text-muted)] i-lucide-x size-3.5"
                :aria-label="t('GOTCHU_AGENT.PROCEDURE.REMOVE_PHRASE')"
                @click="removePhrase(phrase)"
              />
            </span>
            <template v-if="!readOnly">
              <input
                v-if="addingPhrase"
                v-model="newPhrase"
                class="px-3 py-1 text-sm border rounded-full border-[var(--g-border)] bg-[var(--g-surface)] text-[var(--g-text)]"
                data-testid="procedure-phrase-input"
                @keydown.enter.prevent="addPhrase"
                @blur="addPhrase"
              />
              <button
                v-else
                type="button"
                class="px-0 text-sm font-medium border-0 bg-transparent text-[var(--g-agent)]"
                data-testid="procedure-add-phrase"
                @click="addingPhrase = true"
              >
                {{ t('GOTCHU_AGENT.PROCEDURE.ADD_PHRASE') }}
              </button>
            </template>
          </div>
          <p
            v-if="showError('phrases')"
            class="mb-0 text-xs text-[var(--g-danger-text)]"
          >
            {{ t(showError('phrases')) }}
          </p>
        </section>

        <section class="flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3">
            <h2 class="m-0 [font:var(--g-text-section)] text-[var(--g-text)]">
              {{ t('GOTCHU_AGENT.PROCEDURE.DO_THIS') }}
            </h2>
            <Button
              v-if="!readOnly && !isNew"
              :label="
                editing
                  ? t('GOTCHU_AGENT.PROCEDURE.PREVIEW')
                  : t('GOTCHU_AGENT.PROCEDURE.EDIT')
              "
              size="sm"
              variant="link"
              data-testid="procedure-edit-toggle"
              @click="editing = !editing"
            />
          </div>
          <div :class="CARD">
            <TextArea
              v-if="editing"
              v-model="form.body"
              :max-length="MAX_BODY_LENGTH"
              show-character-count
              auto-height
              min-height="12rem"
              max-height="40rem"
              :message="showError('body') ? t(showError('body')) : ''"
              :message-type="showError('body') ? 'error' : 'info'"
              :disabled="readOnly"
              data-testid="procedure-body"
            />
            <template v-else>
              <template v-for="(block, i) in blocks" :key="i">
                <div
                  v-if="block.branch"
                  class="pl-4 border-l-2 border-[var(--g-agent-border)]"
                  data-testid="procedure-branch"
                >
                  <p
                    class="mb-1 text-[11px] font-semibold uppercase tracking-[.04em] text-[var(--g-text-muted)]"
                  >
                    {{ block.label }}
                  </p>
                  <p
                    class="mb-0 whitespace-pre-line [font:var(--g-text-body)] text-[var(--g-text)]"
                  >
                    {{ block.text }}
                  </p>
                </div>
                <p
                  v-else
                  class="mb-0 whitespace-pre-line [font:var(--g-text-body)] text-[var(--g-text)]"
                >
                  {{ block.text }}
                </p>
              </template>
            </template>
          </div>
          <p class="mb-0 text-sm text-[var(--g-text-muted)]">
            {{ t('GOTCHU_AGENT.PROCEDURE.BRIEF_HINT') }}
          </p>
        </section>
      </div>
    </template>

    <template v-if="procedure && !unconfigured" #side>
      <div :class="CARD">
        <h3 class="m-0 text-sm font-semibold text-[var(--g-text)]">
          {{ t('GOTCHU_AGENT.PROCEDURE.MAY_SEND') }}
        </h3>
        <ProcedureTiers :procedure="procedure" :read-only="readOnly" />
      </div>

      <div :class="CARD">
        <h3 class="m-0 text-sm font-semibold text-[var(--g-text)]">
          {{ t('GOTCHU_AGENT.PROCEDURE.MAY_OFFER') }}
        </h3>
        <p class="flex items-center gap-2 mb-0 text-sm text-[var(--g-text)]">
          <span
            class="size-2 rounded-full"
            :class="
              offersGoodwill
                ? 'bg-[var(--g-agent)]'
                : 'shadow-[inset_0_0_0_1.5px_var(--g-border-strong)]'
            "
            data-testid="offer-goodwill-dot"
          />
          {{ t('GOTCHU_AGENT.PROCEDURE.OFFER_GOODWILL') }}
        </p>
        <p
          class="flex items-center gap-2 mb-0 text-sm text-[var(--g-text-muted)]"
        >
          <span
            class="size-2 rounded-full shadow-[inset_0_0_0_1.5px_var(--g-border-strong)]"
          />
          {{ t('GOTCHU_AGENT.PROCEDURE.OFFER_CANCEL') }}
          <NotBuiltChip />
        </p>
      </div>

      <div :class="CARD" data-testid="procedure-last-replay">
        <h3 class="m-0 text-sm font-semibold text-[var(--g-text)]">
          {{ t('GOTCHU_AGENT.PROCEDURE.LAST_REPLAY_TITLE') }}
        </h3>
        <template v-if="replayLines">
          <p class="mb-0 text-sm text-[var(--g-text)]">
            {{
              t('GOTCHU_AGENT.PROCEDURE.LAST_REPLAY', {
                matched: replayLines.matched,
                considered: replayLines.considered,
              })
            }}
          </p>
          <p class="mb-0 text-sm text-[var(--g-text-muted)]">
            {{
              t('GOTCHU_AGENT.PROCEDURE.LAST_REPLAY_AMBIGUOUS', {
                ambiguous: replayLines.ambiguous,
              })
            }}
          </p>
          <p
            v-if="replayLines.capped"
            class="mb-0 text-xs text-[var(--g-text-muted)]"
          >
            {{ t(replayLines.capped.key, replayLines.capped.params) }}
          </p>
          <p
            v-if="replayLines.partial"
            class="mb-0 text-xs text-[var(--g-text-muted)]"
          >
            {{ t('PROCEDURES_MGMT.REPLAY.TIMED_OUT') }}
          </p>
        </template>
        <p v-else class="mb-0 text-sm text-[var(--g-text-muted)]">
          {{ t('GOTCHU_AGENT.PROCEDURE.NO_REPLAY') }}
        </p>
      </div>
    </template>
  </AgentPage>
  <HistoryPanel ref="history" :revisions="revisions" />
</template>
