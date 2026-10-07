<script setup>
import { computed, ref } from 'vue';
import Icon from 'dashboard/components-next/icon/Icon.vue';

// The switch under the draft: what the supporter is writing — an instruction
// for Gotchu, a reply for the customer, or a team-only memo. ReplyBox owns the
// mode; this only asks for a change. Only Reply and the Send draft button can
// reach a customer, and this component can send nothing.
const props = defineProps({
  mode: {
    type: String,
    required: true,
    validator: value => ['instruct', 'reply', 'memo'].includes(value),
  },
  // Instruct is offered only while there is a draft to instruct about.
  instructAvailable: { type: Boolean, default: false },
  hasDraft: { type: Boolean, default: false },
  isNote: { type: Boolean, default: false },
});

const emit = defineEmits(['update:mode']);

const MODES = [
  { key: 'instruct', icon: 'i-lucide-pencil' },
  { key: 'reply', icon: 'i-lucide-reply' },
  { key: 'memo', icon: 'i-lucide-lock' },
];

const modes = computed(() =>
  MODES.filter(({ key }) => key !== 'instruct' || props.instructAvailable)
);

const hintKey = computed(() => {
  if (props.mode === 'instruct') return 'GOTCHU.COMPOSER.HINT.INSTRUCT';
  if (props.mode === 'memo') return 'GOTCHU.COMPOSER.HINT.MEMO';
  if (props.isNote) return 'GOTCHU.COMPOSER.HINT.NOTE';
  return props.hasDraft
    ? 'GOTCHU.COMPOSER.HINT.REPLY_WITH_DRAFT'
    : 'GOTCHU.COMPOSER.HINT.REPLY';
});

const buttons = ref({});

// ARIA radiogroup: arrows move the selection and the focus, wrapping at the
// ends. Only the checked radio is in the tab order.
const move = (key, step) => {
  const list = modes.value;
  const from = list.findIndex(mode => mode.key === key);
  const next = list[(from + step + list.length) % list.length].key;
  emit('update:mode', next);
  buttons.value[next]?.focus();
};

const onKeydown = (event, key) => {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[
    event.key
  ];
  if (!step) return;
  event.preventDefault();
  move(key, step);
};
</script>

<template>
  <div class="composer-modes flex flex-col items-center gap-2">
    <div
      role="radiogroup"
      :aria-label="$t('GOTCHU.COMPOSER.MODES_LABEL')"
      class="mode-group"
    >
      <button
        v-for="item in modes"
        :key="item.key"
        :ref="el => (buttons[item.key] = el)"
        type="button"
        role="radio"
        class="mode"
        :class="{ 'is-on': mode === item.key, [`is-${item.key}`]: true }"
        :aria-checked="mode === item.key ? 'true' : 'false'"
        :tabindex="mode === item.key ? 0 : -1"
        :data-testid="`composer-mode-${item.key}`"
        @click="emit('update:mode', item.key)"
        @keydown="onKeydown($event, item.key)"
      >
        <Icon :icon="item.icon" class="size-3.5" />
        {{ $t(`GOTCHU.COMPOSER.MODE.${item.key.toUpperCase()}`) }}
      </button>
    </div>
    <p class="mhint">{{ $t(hintKey) }}</p>
  </div>
</template>

<style lang="scss" scoped>
.mode-group {
  @apply inline-flex items-center gap-1 p-1 rounded-[10px] bg-[var(--g-slate-tint)];

  box-shadow: inset 0 0 0 1px var(--g-border);
}

.mode {
  @apply inline-flex items-center gap-1.5 h-[34px] px-4 text-[13px] font-medium border-0 rounded-[7px] bg-transparent text-[var(--g-text-muted)] transition-colors duration-[var(--g-dur-hover)] ease-[var(--g-ease-out)];

  &.is-on {
    @apply font-semibold text-[var(--g-text)] bg-[var(--g-surface)];

    box-shadow: 0 1px 2px rgb(20 33 61 / 12%);
  }

  &.is-memo.is-on {
    @apply bg-[var(--g-ink)] text-[var(--g-on-ink)];
  }
}

.mhint {
  @apply m-0 text-xs text-center text-[var(--g-text-muted)];
}
</style>
