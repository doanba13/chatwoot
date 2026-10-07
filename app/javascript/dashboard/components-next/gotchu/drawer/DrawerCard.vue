<script setup>
import { computed, ref } from 'vue';

// One fixed card of the conversation sidebar. Controlled when `open` is given
// (ContactPanel keeps it in the UI settings), self-managed otherwise.
const props = defineProps({
  title: { type: String, required: true },
  open: { type: Boolean, default: undefined },
  defaultOpen: { type: Boolean, default: true },
});
const emit = defineEmits(['toggle']);

const own = ref(props.defaultOpen);
const isOpen = computed(() => props.open ?? own.value);

const toggle = () => {
  const next = !isOpen.value;
  if (props.open === undefined) own.value = next;
  emit('toggle', next);
};
</script>

<template>
  <section
    class="border border-solid border-[var(--g-border)] rounded-[10px] bg-[var(--g-surface)] mb-3"
  >
    <button
      type="button"
      class="flex items-center justify-between w-full gap-2 p-4 text-left bg-transparent border-0 cursor-pointer"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <h3
        class="flex items-center gap-2 m-0 text-[13px] leading-[18px] font-semibold text-[var(--g-text)]"
      >
        {{ title }}
        <slot name="chip" />
      </h3>
      <span class="flex items-center gap-2 text-[var(--g-text-muted)]">
        <slot name="summary" />
        <span
          class="i-lucide-chevron-down size-4 transition-transform"
          :class="{ 'rotate-180': isOpen }"
          aria-hidden="true"
        />
      </span>
    </button>
    <div v-if="isOpen" class="flex flex-col gap-3 px-4 pb-4">
      <slot />
    </div>
  </section>
</template>
