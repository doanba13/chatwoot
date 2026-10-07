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
    <h3 class="m-0">
      <button
        type="button"
        class="flex items-center justify-between w-full gap-2 p-4 text-left bg-transparent border-0 cursor-pointer text-[13px] leading-[18px] font-semibold text-[var(--g-text)]"
        :aria-expanded="isOpen"
        @click="toggle"
      >
        <span class="flex items-center gap-2">
          {{ title }}
          <slot name="chip" />
        </span>
        <span
          class="flex items-center gap-2 font-normal text-[var(--g-text-muted)]"
        >
          <slot name="summary" />
          <span
            class="i-lucide-chevron-down size-4 transition-transform"
            :class="{ 'rotate-180': isOpen }"
            aria-hidden="true"
          />
        </span>
      </button>
    </h3>
    <div v-if="isOpen" class="flex flex-col gap-3 px-4 pb-4">
      <slot />
    </div>
  </section>
</template>
