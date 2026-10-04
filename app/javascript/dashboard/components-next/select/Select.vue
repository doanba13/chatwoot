<script setup>
import Icon from 'dashboard/components-next/icon/Icon.vue';

defineProps({
  options: {
    type: Array,
    default: () => [],
    validator: options =>
      options.every(
        opt => typeof opt === 'object' && 'value' in opt && 'label' in opt
      ),
  },
  groups: {
    type: Array,
    default: () => [],
    validator: groups =>
      groups.every(
        group =>
          'label' in group &&
          Array.isArray(group.options) &&
          group.options.every(opt => 'value' in opt && 'label' in opt)
      ),
  },
  placeholder: {
    type: String,
    default: '',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  error: {
    type: String,
    default: '',
  },
  ariaLabel: {
    type: String,
    default: '',
  },
});

const modelValue = defineModel({
  type: [String, Number, Boolean],
  default: '',
});
</script>

<template>
  <div class="w-fit relative">
    <select
      v-model="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || undefined"
      class="appearance-none bg-none rounded-md border-0 outline-1 outline -outline-offset-1 transition-all duration-200 bg-[--g-surface] !mb-0 h-10 py-2 px-3 pr-10 text-sm"
      :class="{
        'outline-[--g-border] hover:outline-[--g-border-strong] focus:outline-n-blue-9 focus:ring-[3px] focus:ring-[--g-slate-tint]':
          !error && !disabled,
        'outline-n-ruby-9 focus:outline-n-ruby-9 ring-[3px] ring-[--g-danger-tint]':
          error && !disabled,
        'outline-[--g-border] bg-n-slate-2 cursor-not-allowed opacity-60':
          disabled,
      }"
    >
      <option v-if="placeholder" value="" disabled>
        {{ placeholder }}
      </option>
      <template v-if="groups.length">
        <optgroup
          v-for="group in groups"
          :key="group.label"
          :label="group.label"
        >
          <option
            v-for="option in group.options"
            :key="option.value"
            :value="option.value"
            :disabled="option.disabled"
          >
            {{ option.label }}
          </option>
        </optgroup>
      </template>
      <template v-else>
        <option
          v-for="option in options"
          :key="option.value"
          :value="option.value"
          :disabled="option.disabled"
          :title="option.title || undefined"
        >
          {{ option.label }}
        </option>
      </template>
    </select>
    <div
      class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none"
    >
      <Icon
        icon="i-lucide-chevron-down"
        class="size-3.5 text-n-slate-11"
        :class="{ 'opacity-50': disabled }"
      />
    </div>
  </div>
</template>
