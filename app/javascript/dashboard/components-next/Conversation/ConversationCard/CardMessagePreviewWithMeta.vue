<script setup>
import { computed, ref } from 'vue';
import { useSnakeCase } from 'dashboard/composables/useTransformKeys';

import MessagePreview from 'dashboard/components-next/Conversation/ConversationCard/MessagePreview.vue';
import CardLabels from 'dashboard/components-next/Conversation/ConversationCard/CardLabels.vue';
import SLACardLabel from 'dashboard/components-next/Conversation/ConversationCard/SLACardLabel.vue';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  accountLabels: {
    type: Array,
    required: true,
  },
  contact: {
    type: Object,
    required: true,
  },
  hasLabels: {
    type: Boolean,
    default: false,
  },
  // Threaded through to MessagePreview. False when the card above draws the
  // subject itself; the default keeps Chatwoot's subject-first preview for any
  // caller that does not.
  preferSubject: {
    type: Boolean,
    default: true,
  },
});

const slaCardLabelRef = ref(null);

const lastNonActivityMessage = computed(() =>
  useSnakeCase(props.conversation.lastNonActivityMessage ?? {}, { deep: true })
);

const unreadMessagesCount = computed(() => {
  const { unreadCount } = props.conversation;
  return unreadCount;
});

const hasSlaThreshold = computed(() => {
  return (
    !props.contact?.blocked &&
    slaCardLabelRef.value?.hasSlaThreshold &&
    props.conversation?.appliedSla?.id
  );
});

defineExpose({
  hasSlaThreshold,
});
</script>

<template>
  <div class="flex flex-col w-full gap-1">
    <div class="flex items-center justify-between w-full gap-2 py-1 h-7">
      <MessagePreview
        :message="lastNonActivityMessage"
        :prefer-subject="preferSubject"
        class="flex-1 min-w-0"
        :class="unreadMessagesCount > 0 ? 'text-n-slate-12' : 'text-n-slate-11'"
      />

      <div
        v-if="unreadMessagesCount > 0"
        class="inline-flex items-center justify-center flex-shrink-0 rounded-full size-5 bg-n-brand"
      >
        <span class="text-xs font-semibold text-white">
          {{ unreadMessagesCount }}
        </span>
      </div>
    </div>

    <!-- The assignee avatar used to sit at the end of this row, and this row
    only renders when there is an SLA threshold or a label. CardAssignmentState
    in the card above now shows the assignment on every row, so keeping it here
    would draw the same avatar twice on a labelled conversation. -->
    <div
      class="grid items-center gap-2.5 h-7"
      :class="
        hasSlaThreshold && hasLabels
          ? 'grid-cols-[auto_auto_1fr]'
          : 'grid-cols-[1fr]'
      "
    >
      <SLACardLabel
        v-show="hasSlaThreshold"
        ref="slaCardLabelRef"
        :conversation="conversation"
      />
      <div v-if="hasSlaThreshold && hasLabels" class="w-px h-3 bg-n-slate-4" />
      <div v-if="hasLabels" class="overflow-hidden">
        <CardLabels
          :conversation-labels="conversation.labels"
          :account-labels="accountLabels"
        />
      </div>
    </div>
  </div>
</template>
