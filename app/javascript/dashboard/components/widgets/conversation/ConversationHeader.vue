<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { useElementSize } from '@vueuse/core';
import BackButton from '../BackButton.vue';
import InboxName from '../InboxName.vue';
import MoreActions from './MoreActions.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import ConversationCallButton from './ConversationCallButton.vue';
import wootConstants from 'dashboard/constants/globals';
import { conversationListPageURL } from 'dashboard/helper/URLHelper';
import { snoozedReopenTime } from 'dashboard/helper/snoozeHelpers';
import { useInbox } from 'dashboard/composables/useInbox';
import { useAlert } from 'dashboard/composables';
import { useI18n } from 'vue-i18n';
import { copyTextToClipboard } from 'shared/helpers/clipboard';
import Button from 'dashboard/components-next/button/Button.vue';
import AssignButton from 'dashboard/components-next/gotchu/header/AssignButton.vue';
import { headerMeta } from 'dashboard/components-next/gotchu/header/headerMeta';
import { useDraftMeta } from 'dashboard/components-next/gotchu/helpers/draftMeta';
import {
  ensureLoaded as ensureStoresLoaded,
  stores as sharedStores,
} from 'dashboard/components-next/gotchu/agent/sharedStores';

const props = defineProps({
  chat: {
    type: Object,
    default: () => ({}),
  },
  showBackButton: {
    type: Boolean,
    default: false,
  },
});

// Two letters, an optional hyphen, then the digits — `#PL-5563`, `PL5713` and
// `#CU1095` all name the same thing, because the store registry normalises the
// hyphen away and customers drop it as often as not. The capture group is what
// makes `split` hand the matches back alongside the text around them, so the
// parity of the index says which is which; that has to be read before the empty
// segments are dropped, because filtering first would shift it.
const ORDER_NUMBER_PATTERN = /(#?\b[a-z]{2}-?\d{3,}\b)/i;

// The design's separator between the contact and the subject. It lives here
// rather than inline because a bare `›` in the template is an eslint error
// (`vue/no-bare-strings-in-template`) and its allowlist is shared config this
// pass does not own. It is decorative, so the separator is aria-hidden.
const SUBJECT_SEPARATOR = '›';

const { t } = useI18n();

// Written out one key at a time rather than interpolated from the status: a key
// assembled at runtime is invisible to the i18n linter and to anyone grepping
// for what still needs translating, and a status with no entry here renders
// nothing rather than the key itself.
const STATUS_LABELS = {
  [wootConstants.STATUS_TYPE.OPEN]: () =>
    t('CHAT_LIST.CHAT_STATUS_FILTER_ITEMS.open.TEXT'),
  [wootConstants.STATUS_TYPE.RESOLVED]: () =>
    t('CHAT_LIST.CHAT_STATUS_FILTER_ITEMS.resolved.TEXT'),
  [wootConstants.STATUS_TYPE.PENDING]: () =>
    t('CHAT_LIST.CHAT_STATUS_FILTER_ITEMS.pending.TEXT'),
  [wootConstants.STATUS_TYPE.SNOOZED]: () =>
    t('CHAT_LIST.CHAT_STATUS_FILTER_ITEMS.snoozed.TEXT'),
};

const store = useStore();
const route = useRoute();
const conversationHeader = ref(null);
const { width } = useElementSize(conversationHeader);
const { isAWebWidgetInbox } = useInbox();

const currentChat = computed(() => store.getters.getSelectedChat);
const accountId = computed(() => store.getters.getCurrentAccountId);

const chatMetadata = computed(() => props.chat.meta);

const backButtonUrl = computed(() => {
  const {
    params: { inbox_id: inboxId, label, teamId, id: customViewId, queue },
    name,
  } = route;

  const conversationTypeMap = {
    conversation_through_mentions: 'mention',
    conversation_through_participating: 'participating',
    conversation_through_unattended: 'unattended',
  };
  return conversationListPageURL({
    accountId: accountId.value,
    inboxId,
    label,
    teamId,
    conversationType: conversationTypeMap[name],
    customViewId,
    queue,
  });
});

const isHMACVerified = computed(() => {
  if (!isAWebWidgetInbox.value) {
    return true;
  }
  return chatMetadata.value.hmac_verified;
});

const currentContact = computed(() =>
  store.getters['contacts/getContact'](props.chat.meta.sender.id)
);

const isSnoozed = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.SNOOZED
);

const snoozedDisplayText = computed(() => {
  const { snoozed_until: snoozedUntil } = currentChat.value;
  if (snoozedUntil) {
    return `${t('CONVERSATION.HEADER.SNOOZED_UNTIL')} ${snoozedReopenTime(snoozedUntil)}`;
  }
  return t('CONVERSATION.HEADER.SNOOZED_UNTIL_NEXT_REPLY');
});

const inbox = computed(() => {
  const { inbox_id: inboxId } = props.chat;
  return store.getters['inboxes/getInbox'](inboxId);
});

const hasMultipleInboxes = computed(
  () => store.getters['inboxes/getInboxes'].length > 1
);

// The subject is the second half of the header line. On an email conversation it
// is also where the order number usually is: customers put the code in the
// Subject and describe only the situation in the body.
const mailSubject = computed(
  () => props.chat.additional_attributes?.mail_subject || ''
);

const subjectParts = computed(() =>
  mailSubject.value
    .split(ORDER_NUMBER_PATTERN)
    .map((text, index) => ({ id: index, text, mono: index % 2 === 1 }))
    .filter(part => part.text)
);

const statusLabel = computed(() => {
  const label = STATUS_LABELS[currentChat.value.status];
  return label ? label() : '';
});

const draftMeta = useDraftMeta(computed(() => props.chat.id));

watch(accountId, id => ensureStoresLoaded(id), { immediate: true });

const meta = computed(() =>
  headerMeta({
    storeKey: props.chat.custom_attributes?.store_key,
    stores: sharedStores.value,
    draftMeta: draftMeta.value,
    inboxChannelType: inbox.value?.channel_type,
    t,
  })
);

const isPending = computed(
  () => currentChat.value.status === wootConstants.STATUS_TYPE.PENDING
);

const markPending = () =>
  store
    .dispatch('toggleStatus', {
      conversationId: props.chat.id,
      status: wootConstants.STATUS_TYPE.PENDING,
    })
    .then(() => useAlert(t('CONVERSATION.CHANGE_STATUS')));

const hasSlaPolicyId = computed(
  () => props.chat?.applied_sla?.id && !currentContact.value?.blocked
);

const copyConversationId = async () => {
  try {
    await copyTextToClipboard(String(props.chat.id));
    useAlert(t('CONVERSATION.HEADER.COPY_ID_SUCCESS'));
  } catch (error) {
    // error
  }
};
</script>

<template>
  <!-- Spec header: store dot, contact › subject on line one; "store · channel ·
    language", the id and the snooze note on line two. Assign and Mark pending
    sit with the status chip; Resolve lives in MoreActions' sibling and stays
    slate, so Send draft is the only brand-coloured control. -->
  <div
    ref="conversationHeader"
    class="flex flex-col gap-3 items-center justify-between flex-1 w-full min-w-0 xl:flex-row px-5 xl:px-7 pt-3 pb-2 xl:py-4 h-auto"
  >
    <div
      class="flex items-center justify-start w-full xl:w-auto max-w-full min-w-0 xl:flex-1"
    >
      <BackButton
        v-if="showBackButton"
        :back-url="backButtonUrl"
        class="me-2"
      />
      <span
        v-if="meta.storeIndex"
        aria-hidden="true"
        class="flex-shrink-0 me-2.5 size-2 rounded-full"
        :style="{ backgroundColor: `var(--g-store-${meta.storeIndex})` }"
      />
      <div class="flex flex-col min-w-0 gap-0.5 flex-1">
        <div class="flex flex-row items-center min-w-0 gap-1.5">
          <span
            class="text-base font-semibold truncate leading-6 text-n-slate-12"
          >
            {{ currentContact.name }}
          </span>
          <fluent-icon
            v-if="!isHMACVerified"
            v-tooltip="$t('CONVERSATION.UNVERIFIED_SESSION')"
            size="14"
            class="text-[var(--g-text)] my-0 mx-0 min-w-[14px] flex-shrink-0"
            icon="warning"
          />
          <template v-if="subjectParts.length">
            <span
              aria-hidden="true"
              class="flex-shrink-0 text-sm leading-tight text-[var(--g-text-muted)]"
            >
              {{ SUBJECT_SEPARATOR }}
            </span>
            <span
              :title="mailSubject"
              class="flex-1 min-w-0 text-sm leading-tight truncate text-[var(--g-text-muted)]"
            >
              <span
                v-for="part in subjectParts"
                :key="part.id"
                :class="
                  part.mono ? 'font-[family-name:var(--g-font-mono)]' : ''
                "
                >{{ part.text }}</span
              >
            </span>
          </template>
        </div>
        <div
          class="flex items-center min-w-0 gap-1 overflow-hidden text-xs conversation--header--actions text-[var(--g-text-muted)] text-ellipsis whitespace-nowrap"
        >
          <span v-if="meta.line" class="truncate">{{ meta.line }}</span>
          <span v-if="meta.line">•</span>
          <button
            type="button"
            class="truncate font-[family-name:var(--g-font-mono)] text-xs text-[var(--g-text-muted)] hover:text-[var(--g-text)] !p-0 cursor-pointer"
            @click="copyConversationId"
          >
            {{ `#${chat.id}` }}
          </button>
          <span v-if="hasMultipleInboxes">•</span>
          <InboxName v-if="hasMultipleInboxes" :inbox="inbox" class="!mx-0" />
          <span v-if="isSnoozed">•</span>
          <span v-if="isSnoozed" class="font-medium text-[var(--g-text)]">
            {{ snoozedDisplayText }}
          </span>
        </div>
      </div>
    </div>
    <div
      class="flex flex-row items-center justify-start xl:justify-end flex-shrink-0 gap-3 w-full xl:w-auto header-actions-wrap"
    >
      <SLACardLabel
        v-if="hasSlaPolicyId"
        :chat="chat"
        show-extended-info
        :parent-width="width"
        class="hidden md:flex"
      />
      <ConversationCallButton :inbox="inbox" :chat="currentChat" />
      <AssignButton
        :conversation-id="chat.id"
        :assignee="chatMetadata?.assignee"
      />
      <Button
        v-if="!isPending"
        :label="t('GOTCHU.HEADER.MARK_PENDING')"
        outline
        slate
        sm
        class="flex-shrink-0"
        @click="markPending"
      />
      <span
        v-if="statusLabel"
        class="flex-shrink-0 hidden md:inline-flex items-center px-2.5 py-1 text-xs leading-4 border rounded-[var(--g-radius-control)] border-[var(--g-border)] text-[var(--g-text-muted)]"
      >
        {{ statusLabel }}
      </span>
      <MoreActions :conversation-id="currentChat.id" />
    </div>
  </div>
</template>
