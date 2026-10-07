<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useAlert } from 'dashboard/composables';

import MemosAPI from 'dashboard/api/gotchu/memos';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';

import Button from 'dashboard/components-next/button/Button.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';

// The composer's Memo tab (spec §6.5). It names the conversation, which
// Rails authorises for the signed-in agent before forwarding; by default it
// sends no scope, so the gateway takes the conversation's own store. Nothing
// here can reach a customer: a memo is background for later drafts, and the
// gateway's private note in the thread is the lasting record.
const props = defineProps({
  conversationId: { type: [Number, String], required: true },
  storeKey: { type: String, default: null },
  inboxId: { type: Number, default: null },
});
const emit = defineEmits(['saved']);

const { t } = useI18n();
const M = 'GOTCHU_AGENT.MEMO.';

const text = ref('');
const kind = ref('standing_fact');
// With no store on the conversation nothing is chosen: widening to all
// stores is the supporter's own choice, never a default (spec §6.5: the
// default is exactly the trap the gateway refuses).
const scope = ref(props.storeKey ? 'store' : null);
const busy = ref(false);
const errorKey = ref('');
const checkMessages = ref([]);

// With no store on the conversation there is nothing to derive a scope from,
// and the gateway refuses an absent one, so All stores is the only choice and
// is always sent explicitly, once picked. A store that arrives after the tab
// opened becomes the default again.
const scopes = computed(() =>
  props.storeKey ? ['store', 'all', 'inbox'] : ['all']
);
watch(
  () => props.storeKey,
  key => {
    if (key && scope.value === null) scope.value = 'store';
    if (!key && scope.value !== 'all') scope.value = null;
  }
);
const canAdd = computed(
  () => Boolean(text.value.trim()) && scope.value !== null
);

const SCOPE_LABELS = {
  store: `${M}COMPOSER_SCOPE_STORE`,
  all: `${M}COMPOSER_SCOPE_ALL`,
  inbox: `${M}COMPOSER_SCOPE_INBOX`,
};

const body = () => {
  const memo = {
    text: text.value.trim(),
    kind: kind.value,
    conversation_id: props.conversationId,
  };
  if (scope.value === 'all' || !props.storeKey) {
    return { ...memo, scope: { store_key: null, inbox_id: null } };
  }
  if (scope.value === 'inbox') {
    return {
      ...memo,
      scope: { store_key: props.storeKey, inbox_id: props.inboxId },
    };
  }
  return memo;
};

// Every failure keeps the text.
const add = async () => {
  if (busy.value || !canAdd.value) return;
  busy.value = true;
  errorKey.value = '';
  checkMessages.value = [];
  try {
    await MemosAPI.create(body());
    text.value = '';
    emit('saved');
    useAlert(t(`${M}COMPOSER_SAVED`));
  } catch (error) {
    const status = error?.response?.status;
    const reason = error?.response?.data?.reason;
    if (status === 422 && reason === 'scope_required') {
      errorKey.value = `${M}COMPOSER_SCOPE_REQUIRED`;
    } else if (status === 422) {
      checkMessages.value = (error.response.data?.checks ?? [])
        .filter(c => !c.ok)
        .map(c => c.message);
      errorKey.value = gatewayErrorKey(error);
    } else if (status === 404) {
      errorKey.value = `${M}COMPOSER_NOT_FOUND`;
    } else {
      errorKey.value = gatewayErrorKey(error);
    }
  } finally {
    busy.value = false;
  }
};

const segment = active =>
  active
    ? 'bg-[var(--g-surface)] text-[var(--g-text)] shadow-sm'
    : 'text-[var(--g-text-muted)]';
</script>

<template>
  <div class="flex flex-col gap-2 px-[18px] py-2.5" data-testid="memo-composer">
    <TextArea
      v-model="text"
      :max-length="600"
      show-character-count
      auto-height
      min-height="4rem"
      custom-text-area-wrapper-class="memo-box !border-dashed !border-[var(--g-border-strong)] !bg-[var(--g-surface-note)]"
      :placeholder="t(`${M}COMPOSER_HINT`)"
    />
    <ul
      v-if="checkMessages.length"
      class="flex flex-col gap-1 p-0 m-0 list-none text-xs text-[var(--g-danger-text)]"
    >
      <li v-for="message in checkMessages" :key="message">{{ message }}</li>
    </ul>
    <p
      v-if="!storeKey && scope === null"
      class="mb-0 text-xs text-[var(--g-text-muted)]"
      data-testid="memo-composer-no-store"
    >
      {{ t(`${M}COMPOSER_SCOPE_REQUIRED`) }}
    </p>
    <p
      v-if="errorKey"
      class="mb-0 text-xs text-[var(--g-danger-text)]"
      data-testid="memo-composer-error"
    >
      {{ t(errorKey) }}
    </p>
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="inline-flex p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
          role="group"
        >
          <button
            v-for="k in ['standing_fact', 'style']"
            :key="k"
            type="button"
            class="px-2.5 py-1 text-xs font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)]"
            :class="segment(kind === k)"
            :aria-pressed="kind === k"
            :data-testid="`memo-kind-${k === 'style' ? 'style' : 'fact'}`"
            @click="kind = k"
          >
            {{ t(`${M}KIND.${k.toUpperCase()}`) }}
          </button>
        </div>
        <div
          class="inline-flex p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
          role="group"
        >
          <button
            v-for="s in scopes"
            :key="s"
            type="button"
            class="px-2.5 py-1 text-xs font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)]"
            :class="segment(scope === s)"
            :aria-pressed="scope === s"
            :data-testid="`memo-scope-${s}`"
            @click="scope = s"
          >
            {{ t(SCOPE_LABELS[s]) }}
          </button>
        </div>
      </div>
    </div>
    <!-- The footer row, as in the other modes: a spacer, then the button. -->
    <div class="flex items-center pt-0.5 pb-1">
      <span class="flex-1" />
      <Button
        :label="t(`${M}COMPOSER_ADD`)"
        size="sm"
        :is-loading="busy"
        :disabled="!canAdd"
        data-testid="memo-add"
        @click="add"
      />
    </div>
  </div>
</template>
