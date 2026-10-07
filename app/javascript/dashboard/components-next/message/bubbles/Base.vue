<script setup>
import { computed } from 'vue';

import MessageMeta from '../MessageMeta.vue';
import CaptainGenerationDetails from '../CaptainGenerationDetails.vue';

import { emitter } from 'shared/helpers/mitt';
import { useMessageContext } from '../provider.js';
import { useI18n } from 'vue-i18n';

import MessageFormatter from 'shared/helpers/MessageFormatter.js';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { MESSAGE_VARIANTS, ORIENTATION, SENDER_TYPES } from '../constants';
import { isGotchuNote } from 'dashboard/components-next/gotchu/thread/threadWords';

const props = defineProps({
  hideMeta: { type: Boolean, default: false },
});

const {
  variant,
  orientation,
  inReplyTo,
  shouldGroupWithNext,
  id,
  sender,
  senderType,
  isPrivate,
  contentAttributes,
} = useMessageContext();
const { t } = useI18n();

const isCaptainMessage = computed(
  () =>
    (sender.value?.type ?? senderType.value) === SENDER_TYPES.CAPTAIN_ASSISTANT
);

// Meta is muted under every variant: `n-slate-11` resolves to `--g-text-muted`
// in both themes, and the private note no longer carries an amber of its own.
const metaColorClass = 'text-n-slate-11';

const emailMetaClass = computed(() =>
  variant.value === MESSAGE_VARIANTS.EMAIL ? 'px-3 pb-3' : ''
);

// A note Gotchu wrote reads as Gotchu's: the agent teal border.
const gotchuNote = computed(() =>
  isGotchuNote({
    private: isPrivate.value,
    contentAttributes: contentAttributes.value,
  })
);
// A separate string, chosen instead of PRIVATE's: two border colours on one
// element resolve by Tailwind's emission order, not class order, and grey won.
const PRIVATE_GOTCHU =
  'bg-[var(--g-surface-note)] border border-dashed border-[var(--g-agent-border)] text-n-slate-11 [&_.prosemirror-mention-node]:font-semibold';

const varaintBaseMap = {
  [MESSAGE_VARIANTS.AGENT]:
    'bg-[var(--g-surface)] border border-[var(--g-agent-border)] text-n-slate-12',
  [MESSAGE_VARIANTS.PRIVATE]:
    'bg-[var(--g-surface-note)] border border-dashed border-[var(--g-border-strong)] text-n-slate-11 [&_.prosemirror-mention-node]:font-semibold',
  [MESSAGE_VARIANTS.USER]: 'bg-[var(--g-bubble-customer)] text-n-slate-12',
  [MESSAGE_VARIANTS.ACTIVITY]: 'text-n-slate-11 text-xs',
  [MESSAGE_VARIANTS.BOT]: 'bg-n-solid-iris text-n-slate-12',
  [MESSAGE_VARIANTS.TEMPLATE]: 'bg-n-solid-iris text-n-slate-12',
  [MESSAGE_VARIANTS.ERROR]: 'bg-n-ruby-4 text-n-ruby-12',
  [MESSAGE_VARIANTS.EMAIL]: 'w-full',
  // Unsupported used to be the second amber bubble alongside the private note.
  // Amber is retired, so it takes a neutral ground and ink text. The dashed
  // border stays, but dashed-slate on its own is the private note's treatment —
  // the filled ground and the full-strength text are what keep the two apart.
  [MESSAGE_VARIANTS.UNSUPPORTED]:
    'bg-n-slate-3 border border-dashed border-[var(--g-border-strong)] text-n-slate-12',
};

const orientationMap = {
  [ORIENTATION.LEFT]:
    'left-bubble rounded-[var(--g-radius-card)] ltr:rounded-bl-[4px] rtl:rounded-br-[4px]',
  [ORIENTATION.RIGHT]:
    'right-bubble rounded-[var(--g-radius-card)] ltr:rounded-br-[4px] rtl:rounded-bl-[4px]',
  [ORIENTATION.CENTER]: 'rounded-md',
};

const flexOrientationClass = computed(() => {
  const map = {
    [ORIENTATION.LEFT]: 'justify-start',
    [ORIENTATION.RIGHT]: 'justify-end',
    [ORIENTATION.CENTER]: 'justify-center',
  };

  return map[orientation.value];
});

const maxWidthClass = computed(() => {
  const map = {
    [ORIENTATION.LEFT]: 'max-w-[560px]',
    [ORIENTATION.RIGHT]: 'max-w-[560px]',
    [ORIENTATION.CENTER]: 'max-w-lg',
  };

  return map[orientation.value];
});

const messageClass = computed(() => {
  const classToApply = [
    gotchuNote.value && variant.value === MESSAGE_VARIANTS.PRIVATE
      ? PRIVATE_GOTCHU
      : varaintBaseMap[variant.value],
  ];

  if (variant.value !== MESSAGE_VARIANTS.ACTIVITY) {
    classToApply.push(orientationMap[orientation.value]);
  } else {
    classToApply.push('rounded-lg');
  }

  return classToApply;
});

const scrollToMessage = () => {
  emitter.emit(BUS_EVENTS.SCROLL_TO_MESSAGE, {
    messageId: inReplyTo.value.id,
  });
};

const shouldShowMeta = computed(
  () =>
    !props.hideMeta &&
    !shouldGroupWithNext.value &&
    variant.value !== MESSAGE_VARIANTS.ACTIVITY
);

const replyToPreview = computed(() => {
  if (!inReplyTo) return '';

  const { content, attachments } = inReplyTo.value;

  if (content) return new MessageFormatter(content).formattedMessage;
  if (attachments?.length) {
    const firstAttachment = attachments[0];
    const fileType = firstAttachment.fileType ?? firstAttachment.file_type;

    return t(`CHAT_LIST.ATTACHMENTS.${fileType}.CONTENT`);
  }

  return t('CONVERSATION.REPLY_MESSAGE_NOT_FOUND');
});
</script>

<template>
  <div
    class="text-sm min-w-0"
    :class="[
      messageClass,
      variant !== MESSAGE_VARIANTS.EMAIL ? maxWidthClass : '',
    ]"
  >
    <div
      v-if="inReplyTo"
      class="p-2 -mx-1 mb-2 rounded-lg cursor-pointer bg-n-alpha-black1"
      @click="scrollToMessage"
    >
      <div
        v-dompurify-html="replyToPreview"
        class="prose prose-bubble line-clamp-2"
      />
    </div>
    <slot />
    <template v-if="shouldShowMeta">
      <CaptainGenerationDetails
        v-if="isCaptainMessage"
        :message-id="id"
        class="mt-2"
      >
        <template #meta>
          <MessageMeta :class="[emailMetaClass, metaColorClass]" />
        </template>
      </CaptainGenerationDetails>
      <MessageMeta
        v-else
        :class="[flexOrientationClass, emailMetaClass, metaColorClass]"
        class="mt-2"
      />
    </template>
  </div>
</template>
