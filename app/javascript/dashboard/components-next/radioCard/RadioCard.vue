<script setup>
import { useI18n } from 'vue-i18n';
import Label from 'dashboard/components-next/label/Label.vue';

const props = defineProps({
  id: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    default: '',
  },
  label: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    default: false,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  disabledLabel: {
    type: String,
    default: '',
  },
  disabledMessage: {
    type: String,
    default: '',
  },
  beta: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['select']);

const { t } = useI18n();

const handleChange = () => {
  if (!props.isActive && !props.disabled) {
    emit('select', props.id);
  }
};
</script>

<template>
  <label
    :for="id"
    class="rounded-xl outline outline-1 p-4 transition-all duration-200 py-4 ltr:pl-4 rtl:pr-4 ltr:pr-6 rtl:pl-6 focus-within:has-[:focus-visible]:ring-2 focus-within:has-[:focus-visible]:ring-n-strong"
    :class="[
      disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
      isActive
        ? 'outline-n-blue-9 bg-[var(--g-surface-tank)]'
        : 'outline-[var(--g-border)] bg-[var(--g-surface)]',
      !disabled && !isActive ? 'hover:outline-[var(--g-border-strong)]' : '',
    ]"
  >
    <div class="flex flex-col gap-2 items-start">
      <div class="flex items-center justify-between w-full gap-3">
        <div class="flex items-center gap-2">
          <h3 class="text-heading-3 text-n-slate-12">
            {{ label }}
          </h3>
          <Label v-if="disabled" :label="disabledLabel" color="amber" compact />
          <Label v-if="beta" :label="t('GENERAL.BETA')" color="blue" compact />
        </div>
        <input
          :id="`${id}`"
          :checked="isActive"
          :value="id"
          :name="name || id"
          :disabled="disabled"
          type="radio"
          class="shadow cursor-pointer border-2 border-n-strong appearance-none rounded-full w-[18px] h-[18px] bg-[var(--g-surface)] checked:border-[5px] checked:border-n-brand"
          @change="handleChange"
        />
      </div>
      <p class="text-body-main text-n-slate-11">
        {{ disabled && disabledMessage ? disabledMessage : description }}
      </p>
      <slot />
    </div>
  </label>
</template>
