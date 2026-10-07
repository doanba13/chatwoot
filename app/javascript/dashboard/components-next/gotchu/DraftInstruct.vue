<script setup>
import { computed, onMounted, ref } from 'vue';

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
// One plain text box (spec §2.2), in the dock's `editor` slot under the mode
// switch. It has no submit control of its own: Redraft sits in the footer, and
// Mod+Enter here is the same press. Plain Enter is a newline.
const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  // A submission is in flight. The field locks: every press is an instruction,
  // and two instructions from one thought is the thing to prevent.
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

const box = ref(null);
onMounted(() => {
  if (props.autofocus) box.value?.focus();
});

// Mod+Enter is Redraft. Plain Enter falls through to the textarea's newline.
const onKeydown = event => {
  if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  submit();
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
    class="ed flex flex-col mx-[18px] mt-2.5 mb-1 border rounded-[10px] bg-[var(--g-surface)] border-[var(--g-border)]"
  >
    <textarea
      ref="box"
      :value="modelValue"
      rows="3"
      class="w-full px-3 pt-2.5 pb-1 !m-0 !border-0 !shadow-none !outline-none text-[15px] leading-[22px] bg-transparent resize-none text-[var(--g-text)] placeholder:text-[var(--g-text-muted)] disabled:opacity-60"
      :disabled="busy"
      :maxlength="maxLength"
      :placeholder="$t('GOTCHU.DRAFT.INSTRUCT_PLACEHOLDER')"
      :aria-label="$t('GOTCHU.DRAFT.INSTRUCT_PLACEHOLDER')"
      @input="emit('update:modelValue', $event.target.value)"
      @keydown="onKeydown"
    />
    <!-- Wraps rather than truncating: every sentence here tells an agent what
      to do next. -->
    <div class="tbar flex items-center px-3 pb-2">
      <p class="m-0 text-xs text-pretty" :class="toneClass">
        {{ message || $t('GOTCHU.DRAFT.INSTRUCT_HINT') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* The board's `.ed` focus ring: the agent colour at 15%, around the whole box
   rather than the textarea, which draws no outline of its own. */
.ed:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--g-agent) 15%, transparent);
}
</style>
