<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { factOptions } from './ruleForm';

import Select from 'dashboard/components-next/select/Select.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TagInput from 'dashboard/components-next/taginput/TagInput.vue';
import TagMultiSelectComboBox from 'dashboard/components-next/combobox/TagMultiSelectComboBox.vue';

// One condition of a rule: a fact, an operator from that fact's own `ops`,
// and a value input chosen by the fact's `valueType`. The fact vocabulary is
// the gateway's (`facts` from GET /api/rules), never a copy kept here.
const props = defineProps({
  facts: { type: Array, required: true },
  sending: { type: String, required: true },
  readOnly: { type: Boolean, default: false },
});
const emit = defineEmits(['remove']);
const condition = defineModel({ type: Object, required: true });

const { t, te } = useI18n();
const R = 'GOTCHU_AGENT.RULE.';

const options = computed(() => factOptions(props.facts, props.sending, t, te));
const fact = computed(() =>
  props.facts.find(f => f.name === condition.value.fact)
);

const opOptions = computed(() =>
  (fact.value?.ops ?? []).map(op => {
    const key = `${R}OPS.${op.toUpperCase()}`;
    // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
    return { value: op, label: te(key) ? t(key) : op };
  })
);

const valueOptions = computed(() =>
  (fact.value?.values ?? []).map(v => {
    const key = `${R}VALUES.${v.toUpperCase()}`;
    // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
    return { value: v, label: te(key) ? t(key) : v };
  })
);

const BOOLEAN_OPTIONS = computed(() => [
  { value: true, label: t(`${R}YES`) },
  { value: false, label: t(`${R}NO`) },
]);

const emptyValue = f => {
  if (!f) return [];
  if (f.valueType === 'number') return f.min ?? 0;
  if (f.valueType === 'boolean') return true;
  return [];
};

const factName = computed({
  get: () => condition.value.fact,
  set: name => {
    const next = props.facts.find(f => f.name === name);
    condition.value = {
      fact: name,
      op: next?.ops?.[0] ?? '',
      value: emptyValue(next),
    };
  },
});

const op = computed({
  get: () => condition.value.op,
  set: value => {
    condition.value = { ...condition.value, op: value };
  },
});

const listValue = computed({
  get: () =>
    Array.isArray(condition.value.value) ? condition.value.value : [],
  set: value => {
    condition.value = { ...condition.value, value: [...value] };
  },
});

const numberValue = computed({
  get: () => String(condition.value.value ?? ''),
  set: value => {
    condition.value = { ...condition.value, value: Number(value) };
  },
});

const booleanValue = computed({
  get: () => condition.value.value,
  set: value => {
    condition.value = { ...condition.value, value };
  },
});

// A disabled fact explains itself on its own option (a title), and under the
// row only where it explains something (spec §5.2: Language with a sending
// effect): while a fact is still being picked, or when the row's own fact is
// the disabled one. Under a row already reading "Order contains" it said
// nothing about that row (staging recheck, 2026-10-05).
const reasons = computed(() => {
  const disabled = options.value.filter(o => o.disabled);
  const relevant = condition.value.fact
    ? disabled.filter(o => o.value === condition.value.fact)
    : disabled;
  return [...new Set(relevant.map(o => o.reasonKey))];
});
</script>

<template>
  <div class="flex flex-col gap-1.5" data-testid="condition-row">
    <div class="flex flex-wrap items-start gap-2">
      <Select
        v-model="factName"
        :options="options"
        :disabled="readOnly"
        :placeholder="t('GOTCHU_AGENT.RULE.PICK_FACT')"
        :aria-label="t('GOTCHU_AGENT.RULE.WHEN')"
      />
      <Select
        v-if="fact"
        v-model="op"
        :options="opOptions"
        :disabled="readOnly"
        :aria-label="t('GOTCHU_AGENT.RULE.OPERATOR')"
      />
      <div v-if="fact" class="min-w-[200px] flex-1">
        <TagMultiSelectComboBox
          v-if="fact.valueType === 'enum'"
          v-model="listValue"
          :options="valueOptions"
          :disabled="readOnly"
        />
        <TagInput
          v-else-if="fact.valueType === 'strings'"
          v-model="listValue"
          :disabled="readOnly"
          :placeholder="t('GOTCHU_AGENT.RULE.WORDS_PLACEHOLDER')"
        />
        <Input
          v-else-if="fact.valueType === 'number'"
          v-model="numberValue"
          type="number"
          :min="fact.min == null ? '' : String(fact.min)"
          :max="fact.max == null ? '' : String(fact.max)"
          :disabled="readOnly"
        />
        <Select
          v-else-if="fact.valueType === 'boolean'"
          v-model="booleanValue"
          :options="BOOLEAN_OPTIONS"
          :disabled="readOnly"
        />
      </div>
      <button
        v-if="!readOnly"
        type="button"
        class="p-2 border-0 bg-transparent text-[var(--g-text-muted)] i-lucide-x size-4"
        :aria-label="t('GOTCHU_AGENT.RULE.REMOVE_CONDITION')"
        data-testid="condition-remove"
        @click="emit('remove')"
      />
    </div>
    <p
      v-if="fact?.name === 'line_item_text'"
      class="mb-0 text-xs text-[var(--g-text-muted)]"
    >
      {{ t('GOTCHU_AGENT.RULE.LINE_ITEM_HINT') }}
    </p>
    <p
      v-for="reason in reasons"
      :key="reason"
      class="mb-0 text-xs text-[var(--g-text-muted)]"
    >
      {{ t(reason) }}
    </p>
  </div>
</template>
