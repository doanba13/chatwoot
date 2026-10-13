<script setup>
import { computed, reactive } from 'vue';
import Message from './Message.vue';
import { MESSAGE_TYPES } from './constants.js';
import { useCamelCase } from 'dashboard/composables/useTransformKeys';
import { useMapGetter } from 'dashboard/composables/store.js';
import MessageApi from 'dashboard/api/inbox/message.js';
import { useI18n } from 'vue-i18n';
import ThreadDayLine from 'dashboard/components-next/gotchu/thread/ThreadDayLine.vue';
import ThreadSystemLine from 'dashboard/components-next/gotchu/thread/ThreadSystemLine.vue';
import { threadItems } from 'dashboard/components-next/gotchu/thread/threadItems';
import { bylineFor } from 'dashboard/components-next/gotchu/thread/threadWords';
import { wordStep } from 'dashboard/components-next/gotchu/traceWords';

/**
 * Props definition for the component
 * @typedef {Object} Props
 * @property {Array} readMessages - Array of read messages
 * @property {Array} unReadMessages - Array of unread messages
 * @property {Number} currentUserId - ID of the current user
 * @property {Boolean} isAnEmailChannel - Whether this is an email channel
 * @property {Object} inboxSupportsReplyTo - Inbox reply support configuration
 * @property {Array} messages - Array of all messages [These are not in camelcase]
 * @property {Array} timeline - The gateway's timeline of Gotchu's own events
 * @property {Function} sentDraftFor - message id -> the draft it was sent from, or null
 * @property {String} channelWord - The channel as the header names it, or null
 */
const props = defineProps({
  currentUserId: {
    type: Number,
    required: true,
  },
  firstUnreadId: {
    type: Number,
    default: null,
  },
  isAnEmailChannel: {
    type: Boolean,
    default: false,
  },
  inboxSupportsReplyTo: {
    type: Object,
    default: () => ({ incoming: false, outgoing: false }),
  },
  messages: {
    type: Array,
    default: () => [],
  },
  timeline: {
    type: Array,
    default: () => [],
  },
  sentDraftFor: {
    type: Function,
    default: () => null,
  },
  channelWord: {
    type: String,
    default: null,
  },
});

const emit = defineEmits(['retry']);

const allMessages = computed(() => {
  return useCamelCase(props.messages, {
    deep: true,
    stopPaths: [
      'content_attributes.translations',
      'content_attributes.whatsapp_flow_response.response_json',
    ],
  });
});

const { t, te } = useI18n();

const items = computed(() =>
  threadItems({ messages: allMessages.value, timeline: props.timeline })
);

// Grouping looks at a message's neighbours in the messages alone, so a day line
// or a Gotchu line between two messages never changes it.
const indexById = computed(
  () => new Map(allMessages.value.map((m, index) => [m.id, index]))
);

// An activity line is not someone's turn: it carries no byline. The draft a
// reply came from is looked up once and feeds both the byline and the trace.
const annotate = message => {
  if (message.messageType === MESSAGE_TYPES.ACTIVITY) {
    return { byline: null, sentTrace: [] };
  }
  const sentDraft = props.sentDraftFor(message.id);
  return {
    byline: bylineFor({
      message,
      sentDraft,
      channelWord: props.channelWord,
      t,
    }),
    sentTrace: (sentDraft?.trace || [])
      .map(step => wordStep(step, t, te))
      .filter(Boolean),
  };
};

const annotations = computed(
  () => new Map(allMessages.value.map(m => [m.id, annotate(m)]))
);

const currentChat = useMapGetter('getSelectedChat');

// Cache for fetched reply messages to avoid duplicate API calls
const fetchedReplyMessages = reactive(new Map());

/**
 * Fetches a specific message from the API by trying to get messages around it
 * @param {number} messageId - The ID of the message to fetch
 * @param {number} conversationId - The ID of the conversation
 * @returns {Promise<Object|null>} - The fetched message or null if not found/error
 */
const fetchReplyMessage = async (messageId, conversationId) => {
  // Return cached result if already fetched
  if (fetchedReplyMessages.has(messageId)) {
    return fetchedReplyMessages.get(messageId);
  }

  try {
    const response = await MessageApi.getPreviousMessages({
      conversationId,
      before: messageId + 100,
      after: messageId - 100,
    });

    const messages = response.data?.payload || [];
    const targetMessage = messages.find(msg => msg.id === messageId);

    if (targetMessage) {
      const camelCaseMessage = useCamelCase(targetMessage);
      fetchedReplyMessages.set(messageId, camelCaseMessage);
      return camelCaseMessage;
    }

    // Cache null result to avoid repeated API calls
    fetchedReplyMessages.set(messageId, null);
    return null;
  } catch (error) {
    fetchedReplyMessages.set(messageId, null);
    return null;
  }
};

/**
 * Determines if a message should be grouped with the next message
 * @param {Number} index - Index of the current message
 * @param {Array} searchList - Array of messages to check
 * @returns {Boolean} - Whether the message should be grouped with next
 */
const shouldGroupWithNext = (index, searchList) => {
  if (index === searchList.length - 1) return false;

  const current = searchList[index];
  const next = searchList[index + 1];

  if (next.status === 'failed') return false;

  const nextSenderId = next.senderId ?? next.sender?.id;
  const currentSenderId = current.senderId ?? current.sender?.id;
  const hasSameSender = nextSenderId === currentSenderId;

  const nextMessageType = next.messageType;
  const currentMessageType = current.messageType;

  const areBothTemplates =
    nextMessageType === MESSAGE_TYPES.TEMPLATE &&
    currentMessageType === MESSAGE_TYPES.TEMPLATE;

  if (!hasSameSender || areBothTemplates) return false;

  if (currentMessageType !== nextMessageType) return false;

  // Check if messages are in the same minute by rounding down to nearest minute
  return Math.floor(next.createdAt / 60) === Math.floor(current.createdAt / 60);
};

/**
 * Gets the message that was replied to
 * @param {Object} parentMessage - The message containing the reply reference
 * @returns {Object|null} - The message being replied to, or null if not found
 */
const getInReplyToMessage = parentMessage => {
  if (!parentMessage) return null;

  const inReplyToMessageId =
    parentMessage.contentAttributes?.inReplyTo ??
    parentMessage.content_attributes?.in_reply_to;

  if (!inReplyToMessageId) return null;

  // Try to find in current messages first
  let replyMessage = props.messages?.find(msg => msg.id === inReplyToMessageId);

  // Then try store messages
  if (!replyMessage && currentChat.value?.messages) {
    replyMessage = currentChat.value.messages.find(
      msg => msg.id === inReplyToMessageId
    );
  }

  // Then check fetch cache
  if (!replyMessage && fetchedReplyMessages.has(inReplyToMessageId)) {
    replyMessage = fetchedReplyMessages.get(inReplyToMessageId);
  }

  // If still not found and we have conversation context, fetch it
  if (!replyMessage && currentChat.value?.id) {
    fetchReplyMessage(inReplyToMessageId, currentChat.value.id);
    return null; // Let UI handle loading state
  }

  return replyMessage ? useCamelCase(replyMessage) : null;
};
</script>

<template>
  <!-- Full pane width with 28px gutters, the same edges as the draft card. -->
  <ul class="flex flex-col gap-3 pt-7 px-7 bg-n-surface-1">
    <slot name="beforeAll" />
    <template v-for="entry in items" :key="entry.key">
      <ThreadDayLine v-if="entry.type === 'day'" :date="entry.date" />
      <ThreadSystemLine
        v-else-if="entry.type === 'gotchu'"
        :item="entry.item"
      />
      <template v-else>
        <slot
          v-if="firstUnreadId && entry.message.id === firstUnreadId"
          name="unreadBadge"
        />
        <Message
          v-bind="entry.message"
          :is-email-inbox="isAnEmailChannel"
          :in-reply-to="getInReplyToMessage(entry.message)"
          :group-with-next="
            shouldGroupWithNext(indexById.get(entry.message.id), allMessages)
          "
          :inbox-supports-reply-to="inboxSupportsReplyTo"
          :current-user-id="currentUserId"
          :byline="annotations.get(entry.message.id).byline"
          :sent-trace="annotations.get(entry.message.id).sentTrace"
          data-clarity-mask="True"
          @retry="emit('retry', entry.message)"
        />
      </template>
    </template>
    <slot name="after" />
  </ul>
</template>
