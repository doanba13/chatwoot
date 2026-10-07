<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { OnClickOutside } from '@vueuse/components';
import { useAlert } from 'dashboard/composables';
import Button from 'dashboard/components-next/button/Button.vue';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';

const props = defineProps({
  conversationId: { type: Number, required: true },
  assignee: { type: Object, default: null },
});

const { t } = useI18n();
const store = useStore();
const isOpen = ref(false);

const agents = computed(() => store.getters['agents/getAgents']);

const label = computed(() => props.assignee?.name || t('GOTCHU.HEADER.ASSIGN'));

const items = computed(() =>
  agents.value.map(agent => ({
    label: agent.name,
    value: agent.id,
    action: 'assign',
    thumbnail: { name: agent.name, src: agent.thumbnail },
    isSelected: props.assignee?.id === agent.id,
  }))
);

onMounted(() => {
  if (!agents.value.length) store.dispatch('agents/get');
});

// The same two dispatches ConversationAction makes: the optimistic local
// assignee first, then the request.
const assign = ({ value }) => {
  isOpen.value = false;
  const agent = agents.value.find(a => a.id === value);
  if (!agent) return;
  const assigneeType = agent.assignee_type || 'User';
  store.dispatch('setCurrentChatAssignee', {
    conversationId: props.conversationId,
    assignee: agent,
    assigneeType,
  });
  store
    .dispatch('assignAgent', {
      conversationId: props.conversationId,
      agentId: agent.id,
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
