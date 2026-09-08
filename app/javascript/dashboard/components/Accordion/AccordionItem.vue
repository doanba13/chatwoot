<script setup>
import EmojiOrIcon from 'shared/components/EmojiOrIcon.vue';

defineProps({
  title: {
    type: String,
    required: true,
  },
  compact: {
    type: Boolean,
    default: false,
  },
  icon: {
    type: String,
    default: '',
  },
  emoji: {
    type: String,
    default: '',
  },
  isOpen: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(['toggle']);

const onToggle = () => {
  emit('toggle');
};
</script>

<template>
  <div class="text-sm border-b border-[var(--g-border)]">
    <button
      class="flex items-center justify-between w-full gap-2 px-4 py-3 m-0 transition-colors select-none cursor-grab duration-[var(--g-dur-hover)] ease-[var(--g-ease-out)] hover:bg-[var(--g-slate-tint)] drag-handle"
      @click.stop="onToggle"
    >
      <div class="flex items-center min-w-0 gap-2">
        <EmojiOrIcon
          class="inline-block w-4 text-n-slate-11"
          icon-size="16"
          :icon="icon"
          :emoji="emoji"
        />
        <h5
          class="py-0 pl-0 pr-2 mb-0 text-sm font-semibold truncate text-n-slate-12"
        >
          {{ title }}
        </h5>
      </div>
      <div class="flex flex-row items-center">
        <slot name="button" />
        <div class="flex justify-end w-3 cursor-pointer text-n-slate-11">
          <fluent-icon v-if="isOpen" size="24" icon="subtract" type="solid" />
          <fluent-icon v-else size="24" icon="add" type="solid" />
        </div>
      </div>
    </button>
    <div v-if="isOpen" :class="compact ? 'p-0' : 'px-4 pb-4'">
      <slot />
    </div>
  </div>
</template>
