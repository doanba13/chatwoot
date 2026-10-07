<script setup>
// The board's tick list: a filled agent-colour tick for a step that happened,
// a ring for one that has not.
defineProps({
  steps: { type: Array, required: true },
});
</script>

<template>
  <ol class="flex flex-col gap-2 p-0 m-0 list-none">
    <li
      v-for="step in steps"
      :key="step.key"
      class="flex items-start gap-2 text-[13px] leading-[18px]"
      :data-done="step.done"
    >
      <span
        class="mt-[3px] size-3 shrink-0 rounded-full border-2 border-solid"
        :class="
          step.done
            ? 'bg-[var(--g-agent)] border-[var(--g-agent)]'
            : 'bg-transparent border-[var(--g-border-strong)]'
        "
        aria-hidden="true"
      />
      <span class="flex flex-col">
        <span
          :class="
            step.done ? 'text-[var(--g-text)]' : 'text-[var(--g-text-muted)]'
          "
        >
          {{ step.label }}
        </span>
        <span v-if="step.detail" class="text-[12px] text-[var(--g-text-muted)]">
          {{ step.detail }}
        </span>
      </span>
    </li>
  </ol>
</template>
