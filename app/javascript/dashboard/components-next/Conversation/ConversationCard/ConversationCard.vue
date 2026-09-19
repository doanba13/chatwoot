<script setup>
import { computed, ref } from 'vue';
import { getInboxIconByType } from 'dashboard/helper/inbox';
import { useRouter, useRoute } from 'vue-router';
import { frontendURL, conversationUrl } from 'dashboard/helper/URLHelper.js';
import { dynamicTime, shortTimestamp } from 'shared/helpers/timeHelper';
import { useExactTimestamp } from 'shared/composables/useExactTimestamp';

import Icon from 'dashboard/components-next/icon/Icon.vue';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import CardAssignmentState from './CardAssignmentState.vue';
import CardMessagePreview from './CardMessagePreview.vue';
import CardMessagePreviewWithMeta from './CardMessagePreviewWithMeta.vue';
import CardPriorityIcon from './CardPriorityIcon.vue';

import { mailSubjectFor } from './helpers/mailSubject';

const props = defineProps({
  conversation: {
    type: Object,
    required: true,
  },
  contact: {
    type: Object,
    required: true,
  },
  stateInbox: {
    type: Object,
    required: true,
  },
  accountLabels: {
    type: Array,
    required: true,
  },
  // No call site passes this yet — the two history lists that render this card
  // have no notion of an active row. It exists so that the one that eventually
  // does gets the same treatment as the other two cards rather than inventing a
  // third, and so the treatment itself is testable now.
  selected: {
    type: Boolean,
    default: false,
  },
});

const exactTimestamp = useExactTimestamp();

const router = useRouter();
const route = useRoute();

const cardMessagePreviewWithMetaRef = ref(null);

const currentContact = computed(() => props.contact);

const currentContactName = computed(() => currentContact.value?.name);
const currentContactThumbnail = computed(() => currentContact.value?.thumbnail);
const currentContactStatus = computed(
  () => currentContact.value?.availabilityStatus
);

const inbox = computed(() => props.stateInbox);

const inboxName = computed(() => inbox.value?.name);

const inboxIcon = computed(() => {
  const { channelType, medium, voiceEnabled } = inbox.value;
  return getInboxIconByType(channelType, medium, 'fill', voiceEnabled);
});

const lastActivityAt = computed(() => {
  const timestamp = props.conversation?.timestamp;
  return timestamp ? shortTimestamp(dynamicTime(timestamp)) : '';
});

// Normalized here rather than in CardAssignmentState so that the design
// component stays a renderer: `name` is what the agent serializer calls it and
// `availableName` is what the AgentBot one does, and the previews this replaces
// already read both.
const assignee = computed(() => {
  const { meta: { assignee: agent = {} } = {} } = props.conversation;
  return {
    name: agent.name ?? agent.availableName,
    thumbnail: agent.thumbnail,
    availabilityStatus: agent.availabilityStatus,
  };
});

// See helpers/mailSubject.js for where the subject actually lives and why it is
// read under more than one spelling. Non-email channels have none, so this is ''
// and the line below is not rendered at all — an empty row would read as "this
// thread has no subject", which is a different and wrong claim.
const mailSubject = computed(() => mailSubjectFor(props.conversation));

const hasVisibleLabels = computed(() => {
  const { labels = [] } = props.conversation;
  return props.accountLabels.some(({ title }) => labels.includes(title));
});

const showMessagePreviewWithoutMeta = computed(() => {
  return (
    !cardMessagePreviewWithMetaRef.value?.hasSlaThreshold &&
    !hasVisibleLabels.value
  );
});

const onCardClick = e => {
  const path = frontendURL(
    conversationUrl({
      accountId: route.params.accountId,
      id: props.conversation.id,
    })
  );

  if (e.metaKey || e.ctrlKey) {
    window.open(
      window.chatwootConfig.hostURL + path,
      '_blank',
      'noopener noreferrer nofollow'
    );
    return;
  }
  router.push({ path });
};
</script>

<template>
  <!-- The selected row is a 3px --g-agent inline-start border plus the tank
  surface, not a background on its own. Copied from ConversationCardExpanded and
  the condensed card so the three cannot drift apart. The 3px comes out of the
  inline-start padding (9 + 3 = the 12px an unselected row has) so that marking a
  row does not shift its content sideways. aria-current carries it for anyone who
  is not reading the colour. -->
  <div
    role="button"
    :aria-current="selected ? 'true' : undefined"
    class="flex w-full gap-3 py-4 transition-all duration-300 ease-in-out cursor-pointer ps-[9px] pe-3 border-s-[3px] border-s-transparent"
    :class="{
      'bg-[var(--g-surface-tank)] !border-s-[var(--g-agent)]': selected,
    }"
    @click="onCardClick"
  >
    <Avatar
      :name="currentContactName"
      :src="currentContactThumbnail"
      :size="24"
      :status="currentContactStatus"
      rounded-full
    />
    <div class="flex flex-col w-full gap-1 min-w-0">
      <div class="flex items-center justify-between h-6 gap-2">
        <h4 class="text-base font-medium truncate text-n-slate-12">
          {{ currentContactName }}
        </h4>
        <div class="flex items-center gap-2">
          <CardPriorityIcon :priority="conversation.priority || null" />
          <div
            v-tooltip.left="inboxName"
            class="flex items-center justify-center flex-shrink-0 rounded-full bg-n-alpha-2 size-5"
          >
            <Icon
              :icon="inboxIcon"
              class="flex-shrink-0 text-n-slate-11 size-3"
            />
          </div>
          <span
            v-tooltip.top="{
              content: exactTimestamp(conversation?.timestamp),
              delay: { show: 500, hide: 0 },
            }"
            class="text-sm text-n-slate-10"
          >
            {{ lastActivityAt }}
          </span>
        </div>
      </div>
      <CardAssignmentState :assignee="assignee" />
      <span
        v-if="mailSubject"
        :title="mailSubject"
        data-testid="card-subject"
        class="text-sm font-medium leading-5 truncate text-n-slate-12"
      >
        {{ mailSubject }}
      </span>
      <!-- Both previews are told not to prefer the subject: it is on its own
      line above, and Chatwoot's default would make the two lines identical. -->
      <CardMessagePreview
        v-show="showMessagePreviewWithoutMeta"
        :conversation="conversation"
        :prefer-subject="false"
      />
      <CardMessagePreviewWithMeta
        v-show="!showMessagePreviewWithoutMeta"
        ref="cardMessagePreviewWithMetaRef"
        :conversation="conversation"
        :prefer-subject="false"
        :contact="contact"
        :account-labels="accountLabels"
        :has-labels="hasVisibleLabels"
      />
    </div>
  </div>
</template>
