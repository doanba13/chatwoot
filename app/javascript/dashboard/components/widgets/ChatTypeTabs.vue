<script setup>
import { computed } from 'vue';
import { useKeyboardEvents } from 'dashboard/composables/useKeyboardEvents';
import wootConstants from 'dashboard/constants/globals';

const props = defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  activeTab: {
    type: String,
    default: wootConstants.ASSIGNEE_TYPE.ME,
  },
});

const emit = defineEmits(['chatTabChange']);

const activeTabIndex = computed(() => {
  return props.items.findIndex(item => item.key === props.activeTab);
});

const onTabChange = selectedTabIndex => {
  if (selectedTabIndex >= 0 && selectedTabIndex < props.items.length) {
    const selectedItem = props.items[selectedTabIndex];
    if (selectedItem.key !== props.activeTab) {
      emit('chatTabChange', selectedItem.key);
    }
  }
};

const keyboardEvents = {
  'Alt+KeyN': {
    action: () => {
      if (props.activeTab === wootConstants.ASSIGNEE_TYPE.ALL) {
        onTabChange(0);
      } else {
        const nextIndex = (activeTabIndex.value + 1) % props.items.length;
        onTabChange(nextIndex);
      }
    },
  },
};

useKeyboardEvents(keyboardEvents);
</script>

<template>
  <div
    class="flex items-center gap-1 px-4 pb-[10px] border-b border-[var(--g-border)]"
  >
    <button
      v-for="(item, index) in items"
      :key="item.key"
      type="button"
      :aria-pressed="item.key === activeTab"
      class="flex items-center gap-1 px-2.5 py-1 min-w-0 text-sm rounded-[var(--g-radius-control)] transition-colors duration-[var(--g-dur-hover)] ease-[var(--g-ease-out)]"
      :class="
        item.key === activeTab
          ? 'bg-[var(--g-surface-tank)] text-[var(--g-text)] font-medium'
          : 'text-[var(--g-text-muted)] hover:text-[var(--g-text)]'
      "
      @click="onTabChange(index)"
    >
      <span class="truncate">{{ item.name }}</span>
      <span class="text-[var(--g-text-muted)] tabular-nums">
        {{ item.count }}
      </span>
    </button>
  </div>
</template>
