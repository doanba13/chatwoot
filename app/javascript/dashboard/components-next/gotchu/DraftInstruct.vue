<script setup>
import { computed } from 'vue';

import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';

// Free text to the agent, and only ever that: "make it shorter", "add the
// tracking number first". There is no path from anything typed here to a reply
// leaving for a customer — the route behind it produces a note and a new draft
// version, nothing else — which is invariant 5 expressed as a component. A
// classifier can be wrong about what a sentence meant; this cannot be a send
// however it is worded.
//
// Props-only, like the dock: the typed text, whether a submission is in flight
// and which sentence to say about the last one all live in the container, because
// all three are answers about a request this component does not make. That split
// is also what lets a spec drive one state at a time.
//
// It renders BELOW the dock band rather than inside it, and pulls itself up over
// the dock's bottom border so the two read as one surface.
const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  // A submission is in flight. The field and the button lock: every press is an
  // instruction, and two instructions from one thought is the thing to prevent.
  busy: {
    type: Boolean,
    default: false,
  },
  // What to say about the LAST submission, already translated. Null says nothing.
  message: {
    type: String,
    default: null,
  },
  // How to say it. `success` is deliberately the strongest thing available —
  // acceptance is all the container can honestly report.
  tone: {
    type: String,
    default: 'info',
    validator: value => ['info', 'success', 'error'].includes(value),
  },
  // The cap the server enforces, passed in rather than hardcoded here so the
  // browser and the boundary cannot drift apart.
  maxLength: {
    type: Number,
    default: 2000,
  },
  // Focus the field when it mounts: the composer's Instruct tab opens it.
  autofocus: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['update:modelValue', 'submit']);

// Trimming is the container's, because what it submits and what it keeps on a
// failure have to be the same string. This only decides whether there is
// anything to press.
const submittable = computed(
  () => !props.busy && props.modelValue.trim() !== ''
);

const submit = () => {
  if (!submittable.value) return;
  emit('submit');
};

const toneClass = computed(() => {
  switch (props.tone) {
    case 'success':
      return 'text-n-teal-10 dark:text-n-teal-10';
    case 'error':
      return 'text-n-ruby-9 dark:text-n-ruby-9';
    default:
      return 'text-[var(--g-text-muted)]';
  }
});
</script>

<template>
  <div
    class="flex flex-col gap-1.5 px-3 pb-2.5 -mt-px border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
  >
    <div class="flex items-center gap-2">
      <Input
        :model-value="modelValue"
        size="sm"
        class="flex-1 min-w-0"
        custom-input-class="!bg-[var(--g-surface)]"
        :disabled="busy"
        :maxlength="maxLength"
        :placeholder="$t('GOTCHU.DRAFT.INSTRUCT_PLACEHOLDER')"
        :autofocus="autofocus"
        @update:model-value="emit('update:modelValue', $event)"
        @enter="submit"
      />
      <Button
        color="teal"
        variant="outline"
        size="sm"
        icon="i-lucide-arrow-up"
        :aria-label="$t('GOTCHU.DRAFT.INSTRUCT_SUBMIT')"
        :is-loading="busy"
        :disabled="!submittable"
        @click="submit"
      />
    </div>
    <!-- Wraps rather than truncating, which is why this is not `Input`'s own
      `message` slot: that one is a single truncated line, and every sentence here
      tells an agent what to do next. -->
    <p v-if="message" class="m-0 text-xs text-pretty" :class="toneClass">
      {{ message }}
    </p>
  </div>
</template>
