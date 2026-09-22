<script setup>
import { computed, onBeforeMount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';
import { useAlert } from 'dashboard/composables';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { procedureErrorKey } from './errors';
import {
  MAX_PHRASES,
  slugError,
  titleError,
  bodyError,
  phrasesError,
  isProcedureFormValid,
} from './validations';

import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import Select from 'dashboard/components-next/select/Select.vue';
import Button from 'dashboard/components-next/button/Button.vue';

const { t } = useI18n();
const router = useRouter();

// Not a real store key -- the sentinel a merchant picks to mean "every
// store", which travels to the API as `store_key: null` (global) rather
// than as this string. Select's own `modelValue` type has no `null`, so the
// selection itself is always a plain string and the translation to/from
// `null` happens only at the API boundary (see `submit` below).
const GLOBAL_STORE_VALUE = '__global__';

const slug = ref('');
const title = ref('');
const body = ref('');
const phrases = ref([]);
const storeSelection = ref(GLOBAL_STORE_VALUE);

// The registry's own store keys, carried on GET /api/procedures precisely so
// this picker never hand-maintains its own copy (task 11 fix round). Starts
// empty and stays empty if the read fails -- "All stores" is always still a
// valid, honest choice, so a failed read degrades the picker rather than
// blocking the form.
const availableStores = ref([]);

const loadStores = async () => {
  try {
    const { data } = await ProceduresAPI.list();
    availableStores.value = data.stores || [];
  } catch (error) {
    useAlert(t(procedureErrorKey(error)));
  }
};

const storeOptions = computed(() => [
  { value: GLOBAL_STORE_VALUE, label: t('PROCEDURES_MGMT.LIST.GLOBAL') },
  ...availableStores.value.map(key => ({ value: key, label: key })),
]);

const storeScopeDescription = computed(() =>
  storeSelection.value === GLOBAL_STORE_VALUE
    ? t('PROCEDURES_MGMT.FORM.STORE.GLOBAL_DESCRIPTION')
    : t('PROCEDURES_MGMT.FORM.STORE.SCOPED_DESCRIPTION', {
        store: storeSelection.value,
      })
);

// Errors show once the field has been touched, or once a submit has been
// attempted -- so a merchant does not see every field turn red before they
// have typed anything, but pressing submit early still shows all of them.
const touched = ref({ slug: false, title: false, body: false, phrases: false });
const submitted = ref(false);
const submitting = ref(false);

const showError = field => submitted.value || touched.value[field];

const slugErrorKey = computed(() => slugError(slug.value));
const titleErrorKey = computed(() => titleError(title.value));
const bodyErrorKey = computed(() => bodyError(body.value));
const phrasesErrorKey = computed(() => phrasesError(phrases.value));

const formValid = computed(() =>
  isProcedureFormValid({
    slug: slug.value,
    title: title.value,
    body: body.value,
    phrases: phrases.value,
  })
);

const goToList = () => router.push({ name: 'procedures_list' });

const submit = async () => {
  submitted.value = true;
  if (!formValid.value) return;

  submitting.value = true;
  try {
    await ProceduresAPI.create({
      slug: slug.value.trim(),
      title: title.value.trim(),
      body: body.value,
      phrases: phrases.value,
      // The sentinel never travels -- omitted (null) means global, exactly
      // as ProcedureService#create's own `.compact` expects.
      store_key:
        storeSelection.value === GLOBAL_STORE_VALUE
          ? null
          : storeSelection.value,
    });
    useAlert(t('PROCEDURES_MGMT.CREATE.API.SUCCESS_MESSAGE'));
    goToList();
  } catch (error) {
    // The typed form stays exactly as it was -- a refusal costs the
    // merchant nothing beyond fixing the field it names (task 11 brief).
    useAlert(t(procedureErrorKey(error)));
  } finally {
    submitting.value = false;
  }
};

onBeforeMount(loadStores);
</script>

<template>
  <div class="w-full max-w-2xl py-6 mx-auto">
    <p class="mb-6 text-body-main text-n-slate-11">
      {{ t('PROCEDURES_MGMT.CREATE.DESCRIPTION') }}
    </p>

    <form class="flex flex-col gap-5" @submit.prevent="submit">
      <Input
        v-model="slug"
        :label="t('PROCEDURES_MGMT.FORM.SLUG.LABEL')"
        :placeholder="t('PROCEDURES_MGMT.FORM.SLUG.PLACEHOLDER')"
        :message="
          showError('slug') && slugErrorKey
            ? t(slugErrorKey)
            : t('PROCEDURES_MGMT.FORM.SLUG.HINT')
        "
        :message-type="showError('slug') && slugErrorKey ? 'error' : 'info'"
        @blur="touched.slug = true"
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

      <div>
        <label class="block mb-1 text-sm font-medium text-n-slate-12">
          {{ t('PROCEDURES_MGMT.FORM.STORE.LABEL') }}
        </label>
        <Select v-model="storeSelection" :options="storeOptions" />
        <p class="mt-1 text-xs text-n-slate-11">
          {{ storeScopeDescription }}
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
          :label="t('PROCEDURES_MGMT.CREATE.SUBMIT')"
          :is-loading="submitting"
          :disabled="submitting"
        />
      </div>
    </form>
  </div>
</template>
