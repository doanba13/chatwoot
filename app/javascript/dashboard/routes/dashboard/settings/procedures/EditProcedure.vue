<script setup>
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useAlert } from 'dashboard/composables';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { procedureErrorKey } from './errors';
import {
  MAX_PHRASES,
  titleError,
  bodyError,
  phrasesError,
  isProcedureFormValid,
} from './validations';

import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import Button from 'dashboard/components-next/button/Button.vue';
import UnconfiguredNotice from './UnconfiguredNotice.vue';
import ChannelTiers from './ChannelTiers.vue';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const procedureId = computed(() => Number(route.params.procedureId));

// There is no GET .../procedures/:id route (task 10's controller offers
// only index/create/update) -- the list is the one read on this surface, so
// loading a single procedure to edit means listing and finding it, same as
// Index.vue's own read.
const isLoading = ref(true);
const procedure = ref(null);
// Same read carries `capabilities.procedures`, gated here the same way
// CreateProcedure.vue is (fix round 2) -- a merchant who bookmarked or typed
// an edit URL directly sees the explanatory empty state rather than "that
// procedure no longer exists", which would be the wrong reason.
const proceduresAvailable = ref(true);

const title = ref('');
const body = ref('');
const phrases = ref([]);

const touched = ref({ title: false, body: false, phrases: false });
const submitted = ref(false);
const submitting = ref(false);

const showError = field => submitted.value || touched.value[field];

const titleErrorKey = computed(() => titleError(title.value));
const bodyErrorKey = computed(() => bodyError(body.value));
const phrasesErrorKey = computed(() => phrasesError(phrases.value));

const formValid = computed(() =>
  isProcedureFormValid({
    title: title.value,
    body: body.value,
    phrases: phrases.value,
  })
);

// Read-only this round -- changing an existing procedure's store is a
// separate, later piece of work (task 11 fix round).
const storeScopeLabel = computed(() =>
  procedure.value?.storeKey
    ? procedure.value.storeKey
    : t('PROCEDURES_MGMT.LIST.GLOBAL')
);

const goToList = () => router.push({ name: 'procedures_list' });

const applyProcedure = data => {
  procedure.value = data;
  title.value = data.title;
  body.value = data.body;
  phrases.value = [...(data.phrases || [])];
};

const loadProcedure = async () => {
  isLoading.value = true;
  try {
    const { data } = await ProceduresAPI.list();
    proceduresAvailable.value = data.capabilities?.procedures === true;
    if (!proceduresAvailable.value) return;

    const found = (data.procedures || []).find(p => p.id === procedureId.value);
    if (!found) {
      useAlert(t('PROCEDURES_MGMT.EDIT.NOT_FOUND'));
      goToList();
      return;
    }
    applyProcedure(found);
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
    goToList();
  } finally {
    isLoading.value = false;
  }
};

const submit = async () => {
  submitted.value = true;
  if (!formValid.value || !procedure.value) return;

  submitting.value = true;
  try {
    const { data } = await ProceduresAPI.update(procedure.value.id, {
      title: title.value.trim(),
      body: body.value,
      phrases: phrases.value,
    });
    // The response is the new revision -- same id, version risen by one
    // (task 11 brief's own verification: "the row keeps its identity").
    applyProcedure(data);
    useAlert(t('PROCEDURES_MGMT.EDIT.API.SUCCESS_MESSAGE'));
    goToList();
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
  } finally {
    submitting.value = false;
  }
};

onBeforeMount(loadProcedure);
</script>

<template>
  <div class="w-full max-w-2xl py-6 mx-auto">
    <woot-loading-state
      v-if="isLoading"
      :message="t('PROCEDURES_MGMT.LOADING')"
    />
    <UnconfiguredNotice v-else-if="!proceduresAvailable" />

    <template v-else-if="procedure">
      <div class="flex items-center gap-2 mb-6 text-sm">
        <span class="font-mono text-n-slate-12">{{ procedure.slug }}</span>
        <span class="text-n-slate-9" aria-hidden="true">·</span>
        <span class="text-n-slate-11">
          {{
            t('PROCEDURES_MGMT.EDIT.VERSION_LABEL', {
              version: procedure.version,
            })
          }}
        </span>
        <span class="text-n-slate-9" aria-hidden="true">·</span>
        <span class="text-n-slate-11">
          {{ t(`PROCEDURES_MGMT.STATUS.${procedure.status.toUpperCase()}`) }}
        </span>
        <span class="text-n-slate-9" aria-hidden="true">·</span>
        <span class="text-n-slate-11">
          {{
            t('PROCEDURES_MGMT.EDIT.STORE_SCOPE', { store: storeScopeLabel })
          }}
        </span>
      </div>

      <ChannelTiers
        :procedure-id="procedure.id"
        :procedure-status="procedure.status"
        :procedure-version="procedure.version"
      />

      <form class="flex flex-col gap-5" @submit.prevent="submit">
        <Input
          :model-value="procedure.slug"
          :label="t('PROCEDURES_MGMT.FORM.SLUG.LABEL')"
          :message="t('PROCEDURES_MGMT.FORM.SLUG.IMMUTABLE')"
          disabled
        />

        <Input
          v-model="title"
          :label="t('PROCEDURES_MGMT.FORM.TITLE.LABEL')"
          :placeholder="t('PROCEDURES_MGMT.FORM.TITLE.PLACEHOLDER')"
          :message="showError('title') && titleErrorKey ? t(titleErrorKey) : ''"
          :message-type="showError('title') && titleErrorKey ? 'error' : 'info'"
          @blur="touched.title = true"
        />

        <TextArea
          v-model="body"
          :label="t('PROCEDURES_MGMT.FORM.BODY.LABEL')"
          :placeholder="t('PROCEDURES_MGMT.FORM.BODY.PLACEHOLDER')"
          :max-length="4000"
          show-character-count
          auto-height
          :message="showError('body') && bodyErrorKey ? t(bodyErrorKey) : ''"
          :message-type="showError('body') && bodyErrorKey ? 'error' : 'info'"
          @blur="touched.body = true"
        />

        <div>
          <label class="block mb-1 text-sm font-medium text-n-slate-12">
            {{ t('PROCEDURES_MGMT.FORM.PHRASES.LABEL') }}
          </label>
          <p class="mb-2 text-xs text-n-slate-11">
            {{ t('PROCEDURES_MGMT.FORM.PHRASES.HINT', { max: MAX_PHRASES }) }}
          </p>
          <div
            class="px-3 py-2 border rounded-xl"
            :class="
              showError('phrases') && phrasesErrorKey
                ? 'border-n-ruby-9'
                : 'border-n-weak'
            "
          >
            <TagInput
              v-model="phrases"
              :placeholder="t('PROCEDURES_MGMT.FORM.PHRASES.PLACEHOLDER')"
              :disabled="phrases.length >= MAX_PHRASES"
              allow-create
              @blur="touched.phrases = true"
            />
          </div>
          <p
            v-if="showError('phrases') && phrasesErrorKey"
            class="mt-1 text-sm text-n-ruby-9"
          >
            {{ t(phrasesErrorKey) }}
          </p>
          <p v-else class="mt-1 text-xs text-n-slate-11">
            {{
              t('PROCEDURES_MGMT.FORM.PHRASES.COUNT', {
                count: phrases.length,
                max: MAX_PHRASES,
              })
            }}
          </p>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2">
          <Button
            faded
            slate
            type="button"
            :label="t('PROCEDURES_MGMT.FORM.CANCEL')"
            @click="goToList"
          />
          <Button
            type="submit"
            :label="t('PROCEDURES_MGMT.EDIT.SUBMIT')"
            :is-loading="submitting"
            :disabled="submitting"
          />
        </div>
      </form>
    </template>
  </div>
</template>
