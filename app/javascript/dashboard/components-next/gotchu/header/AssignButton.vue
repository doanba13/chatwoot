<script setup>
import { computed, ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { OnClickOutside } from '@vueuse/components';
import { useAlert } from 'dashboard/composables';
import { useAgentsList } from 'dashboard/composables/useAgentsList';
import Button from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';

const props = defineProps({
  conversationId: { type: Number, required: true },
  assignee: { type: Object, default: null },
});

const { t } = useI18n();
const store = useStore();
const isOpen = ref(false);

// The list the sidebar's assignee control uses: the inbox's assignable agents
// (ConversationBox fetches them per inbox), bots included, with None first
// while someone is assigned.
const { agentsList } = useAgentsList(true, { includeAgentBots: true });

const label = computed(() => props.assignee?.name || t('GOTCHU.HEADER.ASSIGN'));

const typeOf = agent => agent.assignee_type || 'User';
const keyOf = agent => `${typeOf(agent)}:${agent.id}`;

const items = computed(() =>
  agentsList.value.map(agent => ({
    label: agent.name,
    value: keyOf(agent),
    action: 'assign',
    thumbnail: { name: agent.name, src: agent.thumbnail },
    isSelected: agent.id !== 0 && props.assignee?.id === agent.id,
  }))
);

// The same two dispatches ConversationAction makes: the optimistic local
// assignee first, then the request. None (id 0) sends null, which unassigns.
const assign = ({ value }) => {
  isOpen.value = false;
  const picked = agentsList.value.find(a => keyOf(a) === value);
  if (!picked) return;
  const agent = picked.id === 0 ? null : picked;
  const assigneeType = agent ? typeOf(agent) : null;
  store.dispatch('setCurrentChatAssignee', {
    conversationId: props.conversationId,
    assignee: agent,
    assigneeType,
  });
  store
    .dispatch('assignAgent', {
      conversationId: props.conversationId,
      agentId: agent ? agent.id : null,
      assigneeType,
    })
    .then(() => useAlert(t('CONVERSATION.CHANGE_AGENT')));
};
</script>

<template>
  <OnClickOutside class="relative flex-shrink-0" @trigger="isOpen = false">
    <Button
      ghost
      slate
      sm
      :aria-label="t('GOTCHU.HEADER.ASSIGN_LABEL')"
      class="max-w-[10rem]"
      @click="isOpen = !isOpen"
    >
      <span class="truncate">{{ label }}</span>
    </Button>
    <DropdownMenu
      v-if="isOpen"
      :menu-items="items"
      show-search
      class="mt-1 end-0 top-full w-56 max-h-72"
      @action="assign"
    />
  </OnClickOutside>
</template>
