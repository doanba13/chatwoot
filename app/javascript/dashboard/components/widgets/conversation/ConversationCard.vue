<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { getLastMessage } from 'dashboard/helper/conversationHelper';
import Avatar from 'next/avatar/Avatar.vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';
import MessagePreview from './MessagePreview.vue';
import InboxName from '../InboxName.vue';
import TimeAgo from 'dashboard/components/ui/TimeAgo.vue';
import CardLabels from './conversationCardComponents/CardLabels.vue';
import CardPriorityIcon from 'dashboard/components-next/Conversation/ConversationCard/CardPriorityIcon.vue';
import UnreadBadge from 'dashboard/components-next/Conversation/ConversationCard/UnreadBadge.vue';
import SLACardLabel from './components/SLACardLabel.vue';
import VoiceCallStatus from './VoiceCallStatus.vue';
import Checkbox from 'dashboard/components-next/checkbox/Checkbox.vue';
import { queueChip } from 'dashboard/components-next/gotchu/queueChip';
import {
  ensureLoaded as ensureStoresLoaded,
  storeIndex,
} from 'dashboard/components-next/gotchu/agent/sharedStores';
import { mailSubjectFor } from 'dashboard/components-next/Conversation/ConversationCard/helpers/mailSubject';

const props = defineProps({
  chat: { type: Object, required: true },
  currentContact: { type: Object, required: true },
  assignee: { type: Object, default: () => ({}) },
  inbox: { type: Object, default: () => ({}) },
  selected: { type: Boolean, default: false },
  isActiveChat: { type: Boolean, default: false },
  showAssignee: { type: Boolean, default: false },
  showInboxName: { type: Boolean, default: false },
  hideThumbnail: { type: Boolean, default: false },
  compact: { type: Boolean, default: false },
});

const emit = defineEmits([
  'click',
  'contextmenu',
  'selectConversation',
  'deSelectConversation',
]);

const { t } = useI18n();

const hovered = ref(false);

const unreadCount = computed(() => props.chat.unread_count);
const hasUnread = computed(() => unreadCount.value > 0);
const lastMessageInChat = computed(() => getLastMessage(props.chat));

const voiceCallData = computed(() => {
  const last = lastMessageInChat.value;
  if (last?.content_type !== 'voice_call' || !last.call) {
    return { status: null, direction: null };
  }
  return {
    status: last.call.status,
    direction: last.call.direction === 'outgoing' ? 'outbound' : 'inbound',
  };
});

const showMetaSection = computed(() => {
  return (
    props.showInboxName ||
    (props.showAssignee && props.assignee.name) ||
    props.chat.priority
  );
});

const isAgentBotAssignee = computed(
  () => props.chat?.meta?.assignee_type === 'AgentBot'
);

const hasSlaPolicyId = computed(
  () => props.chat?.applied_sla?.id && !props.currentContact?.blocked
);

const showLabelsSection = computed(() => {
  return props.chat.labels?.length > 0 || hasSlaPolicyId.value;
});

// See helpers/mailSubject.js. `chat` comes out of the main conversations store,
// so the server casing is the shape that arrives here — this condensed row is
// the list the desk scans all day, and the reason the subject is worth showing.
const mailSubject = computed(() => mailSubjectFor(props.chat));
const gotchuChip = computed(() => queueChip(props.chat.custom_attributes, t));

// What follows the chip's label. A hand-over names why: the rule that forced
// it, else the procedure, else "no procedure". Display only.
const gotchuChipDetail = computed(() => {
  const chip = gotchuChip.value;
  if (!chip) return null;
  if (props.chat.custom_attributes?.gotchu_state === 'handed_over') {
    return (
      chip.reason ??
      chip.procedure ??
      t('CONVERSATION.GOTCHU_QUEUE.NO_PROCEDURE')
    );
  }
  return chip.procedure;
});

// The store's dot before the contact name. One shared store list for every
// card, keyed by account; an unknown store draws no dot rather than a default
// colour.
ensureStoresLoaded(props.chat.account_id);
const storeDot = computed(() => {
  const key = props.chat.custom_attributes?.store_key;
  return typeof key === 'string' ? storeIndex(key) : null;
});

// The timestamp and the unread badge are absolutely positioned over the right
// edge of this column, so every full-width line under the name has to leave the
// badge room. Pulled out of messagePreviewClass so the subject line uses the
// same rule instead of restating it.
const unreadBadgeClearanceClass = computed(() => [
  !props.compact && hasUnread.value ? 'ltr:pr-4 rtl:pl-4' : '',
  props.compact && hasUnread.value ? 'ltr:pr-6 rtl:pl-6' : '',
]);

const messagePreviewClass = computed(() => {
  return [
    hasUnread.value ? 'font-medium text-n-slate-12' : 'text-n-slate-11',
    ...unreadBadgeClearanceClass.value,
  ];
});

const onThumbnailHover = () => {
  hovered.value = !props.hideThumbnail;
};

const onThumbnailLeave = () => {
  hovered.value = false;
};

const onSelectConversation = checked => {
  if (checked) {
    emit('selectConversation', props.chat.id, props.inbox.id);
  } else {
    emit('deSelectConversation', props.chat.id, props.inbox.id);
  }
};

const selectedModel = computed({
  get: () => props.selected,
  set: value => onSelectConversation(value),
});

watch(
  () => props.chat.id,
  () => {
    hovered.value = false;
  }
);
</script>

<template>
  <div
    class="relative flex items-start flex-grow-0 flex-shrink-0 w-auto max-w-full py-0 cursor-pointer conversation border-b border-[var(--g-border)] border-s-[3px] border-s-transparent hover:bg-[var(--g-surface-tank)] group"
    :class="{
      'active animate-card-select bg-[var(--g-surface-tank)] !border-s-[var(--g-agent)]':
        isActiveChat,
      'selected bg-[var(--g-surface-tank)] !border-s-[var(--g-agent)]':
        selected,
      'px-0': compact,
      'ps-[13px] pe-4': !compact,
    }"
    @click="$emit('click', $event)"
    @contextmenu="$emit('contextmenu', $event)"
  >
    <div
      class="relative"
      @mouseenter="onThumbnailHover"
      @mouseleave="onThumbnailLeave"
    >
      <Avatar
        v-if="!hideThumbnail"
        :name="currentContact.name"
        :src="currentContact.thumbnail"
        :size="32"
        :status="currentContact.availability_status"
        :class="!showInboxName ? 'mt-4' : 'mt-8'"
        hide-offline-status
      >
        <template #overlay="{ size }">
          <label
            v-if="hovered || selected"
            class="flex items-center justify-center rounded-full cursor-pointer absolute inset-0 z-10 backdrop-blur-[2px]"
            :style="{ width: `${size}px`, height: `${size}px` }"
            @click.stop
          >
            <Checkbox v-model="selectedModel" />
          </label>
        </template>
      </Avatar>
    </div>
    <div class="px-0 py-3 flex-1 min-w-0 border-line">
      <div
        v-if="showMetaSection"
        class="flex items-center min-w-0 gap-1"
        :class="{
          'ltr:ml-2 rtl:mr-2': !compact,
          'mx-2': compact,
        }"
      >
        <InboxName
          v-if="showInboxName"
          :inbox="inbox"
          class="min-w-0 px-1.5 border border-[var(--g-border)] rounded-[var(--g-radius-control)]"
        />
        <div
          class="flex items-baseline gap-2 flex-shrink-0"
          :class="{
            'flex-1 justify-between': !showInboxName,
          }"
        >
          <span
            v-if="showAssignee && assignee.name"
            class="text-xs font-medium leading-3 py-0.5 px-0 inline-flex items-center gap-px truncate"
            :class="
              isAgentBotAssignee ? 'text-[var(--g-agent)]' : 'text-n-slate-12'
            "
          >
            <Icon
              :icon="
                isAgentBotAssignee ? 'i-lucide-bot' : 'i-lucide-user-round'
              "
              class="size-3 flex-shrink-0"
            />
            <span class="truncate">{{ assignee.name }}</span>
          </span>
          <CardPriorityIcon
            :priority="chat.priority"
            class="flex-shrink-0 !size-3.5"
          />
        </div>
      </div>
      <h4
        class="conversation--user text-sm my-0 mx-2 capitalize pt-0.5 font-semibold text-ellipsis overflow-hidden whitespace-nowrap flex-1 min-w-0 ltr:pr-16 rtl:pl-16 text-n-slate-12"
      >
        <span
          v-if="storeDot"
          class="inline-block size-2 rounded-full ltr:mr-1.5 rtl:ml-1.5 align-middle"
          :style="{ background: `var(--g-store-${storeDot})` }"
          data-testid="card-store-dot"
        />{{ currentContact.name }}
      </h4>
      <!-- Subject between the contact and the preview. In a measured sample of
      live threads it is the only place the order number appears in a fair
      number of them, so it is what an agent scans this list for. Absent rather
      than blank on a channel that was never created by a mail. -->
      <p
        v-if="mailSubject"
        :title="mailSubject"
        data-testid="card-subject"
        class="text-n-slate-12 text-sm font-medium my-0 mx-2 leading-6 h-6 flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        :class="unreadBadgeClearanceClass"
      >
        {{ mailSubject }}
      </p>
      <!-- The chip leaves the unread badge its room like every other line
        under the name, and ends in an ellipsis rather than a hard cut. -->
      <p
        v-if="gotchuChip"
        data-testid="card-gotchu-queue"
        class="my-0 mx-2 min-w-0 text-xs leading-5 text-n-slate-11"
        :class="unreadBadgeClearanceClass"
      >
        <span
          class="inline-block max-w-full truncate align-top rounded-md px-1.5"
          :class="
            gotchuChip.agent
              ? 'bg-[var(--g-agent-tint)] ring-1 ring-inset ring-[var(--g-agent-border)]'
              : 'bg-[var(--g-slate-tint)]'
          "
        >
          {{ gotchuChip.label
          }}<template v-if="gotchuChipDetail">
            · {{ gotchuChipDetail }}</template
          >
        </span>
      </p>
      <VoiceCallStatus
        v-if="voiceCallData.status"
        key="voice-status-row"
        :status="voiceCallData.status"
        :direction="voiceCallData.direction"
        :message-preview-class="messagePreviewClass"
      />
      <!-- The subject is on its own line above, so the preview must not prefer
      it: Chatwoot's default would make both lines the same string. -->
      <MessagePreview
        v-else-if="lastMessageInChat"
        key="message-preview"
        :message="lastMessageInChat"
        :prefer-subject="false"
        class="my-0 mx-2 leading-6 h-6 flex-1 min-w-0 text-sm"
        :class="messagePreviewClass"
      />
      <p
        v-else
        key="no-messages"
        class="text-n-slate-11 text-sm my-0 mx-2 leading-6 h-6 flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap"
        :class="messagePreviewClass"
      >
        <fluent-icon
          size="16"
          class="-mt-0.5 align-middle inline-block text-n-slate-10"
          icon="info"
        />
        <span class="mx-0.5">
          {{ $t(`CHAT_LIST.NO_MESSAGES`) }}
        </span>
      </p>
      <div
        class="absolute flex flex-col ltr:right-4 rtl:left-4"
        :class="showMetaSection ? 'top-8' : 'top-4'"
      >
        <span class="ml-auto font-normal leading-4">
          <TimeAgo
            :last-activity-timestamp="chat.timestamp"
            :created-at-timestamp="chat.created_at"
            :conversation-id="chat.id"
            class="!text-xs !text-n-slate-11"
          />
        </span>
        <UnreadBadge
          v-if="hasUnread"
          :count="unreadCount"
          class="ltr:ml-auto rtl:mr-auto mt-1"
        />
      </div>
      <CardLabels
        v-if="showLabelsSection"
        :conversation-labels="chat.labels"
        class="mt-0.5 mx-2 mb-0"
      >
        <template v-if="hasSlaPolicyId" #before>
          <SLACardLabel :chat="chat" class="ltr:mr-1 rtl:ml-1" />
        </template>
      </CardLabels>
    </div>
  </div>
</template>
