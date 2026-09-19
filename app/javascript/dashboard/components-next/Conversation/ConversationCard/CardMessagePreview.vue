<script setup>
import { computed } from 'vue';
import { useSnakeCase } from 'dashboard/composables/useTransformKeys';

import MessagePreview from './MessagePreview.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  // Threaded through to MessagePreview. False when the card above draws the
  // subject itself; the default keeps Chatwoot's subject-first preview for any
  // caller that does not.
  preferSubject: {
    type: Boolean,
    default: true,
  },
});

const lastNonActivityMessage = computed(() =>
  useSnakeCase(props.conversation.lastNonActivityMessage ?? {}, { deep: true })
);

const unreadMessagesCount = computed(() => {
  const { unreadCount } = props.conversation;
  return unreadCount;
});
</script>

<template>
  <div class="flex items-end w-full gap-2 pb-1">
    <MessagePreview
      :message="lastNonActivityMessage"
      multi-line
      :prefer-subject="preferSubject"
      class="w-full"
      :class="unreadMessagesCount > 0 ? 'text-n-slate-12' : 'text-n-slate-11'"
    />
    <!-- The assignee avatar that used to sit here moved up into
    CardAssignmentState, which renders on every row rather than only where a
    preview does. Drawing it in both places put the same avatar on the card
    twice. -->
    <div class="flex items-center flex-shrink-0 gap-2 pb-2">
      <div
        v-if="unreadMessagesCount > 0"
        class="inline-flex items-center justify-center rounded-full size-5 bg-n-brand"
      >
        <span class="text-xs font-semibold text-white">
          {{ unreadMessagesCount }}
        </span>
      </div>
    </div>
  </div>
</template>
