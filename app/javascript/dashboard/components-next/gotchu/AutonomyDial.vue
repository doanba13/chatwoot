<script setup>
import { useId } from 'vue';
import { useI18n } from 'vue-i18n';

import RadioCard from 'dashboard/components-next/radioCard/RadioCard.vue';

// Three radio cards: how much Gotchu is allowed to do without a person. Each one
// is described by what the CUSTOMER experiences, not by what the system does —
// "customers wait a few minutes" rather than "requires approval" — because the
// person choosing is choosing on the customer's behalf.
//
// Props only. None of the three modes exists in any configuration today: the
// reply loop is draft-and-confirm everywhere, there is no per-account autonomy
// setting, and "handle selected topics" additionally needs `TopicSwitch`'s
// per-topic source, which also does not exist. So this renders a choice nothing
// can yet store.
const props = defineProps({
  // Which mode is selected. The source's default is kept: a radio group has to
  // start somewhere, `approve` is the middle rung, and it is the one that cannot
  // surprise a customer either way. It is a control's initial position, not a
  // reading of any stored setting — nothing stores one.
  value: {
    type: String,
    default: 'approve',
  },
  // Modes this account cannot pick. Each renders disabled with `lockTag` beside
  // it, which is RadioCard's own `disabled` + `disabledLabel` pair.
  lockedIds: {
    type: Array,
    default: () => [],
  },
  // Why they are locked, in the caller's words. A plan name, so it stays a prop
  // rather than a catalogue key — Chatwoot does not translate plan names either.
  lockTag: {
    type: String,
    default: 'Growth plan',
  },
});

// `select`, not `change`, and carrying the mode id: it is a straight pass-through
// of RadioCard's own event, so the dial adds no vocabulary of its own.
defineEmits(['select']);

const { t } = useI18n();

// Order is the dial — least autonomy to most, left to right — so it lives here
// rather than being assembled from props. The copy is in the catalogue because
// the desk reads this in German and French; only the ids are structural.
const MODES = [
  {
    id: 'draft',
    titleKey: 'GOTCHU.AUTONOMY.DRAFT_TITLE',
    descriptionKey: 'GOTCHU.AUTONOMY.DRAFT_DESCRIPTION',
  },
  {
    id: 'approve',
    titleKey: 'GOTCHU.AUTONOMY.APPROVE_TITLE',
    descriptionKey: 'GOTCHU.AUTONOMY.APPROVE_DESCRIPTION',
  },
  {
    id: 'handle',
    titleKey: 'GOTCHU.AUTONOMY.HANDLE_TITLE',
    descriptionKey: 'GOTCHU.AUTONOMY.HANDLE_DESCRIPTION',
  },
];

// RadioCard defaults its `name` to its own `id`, which makes three INDEPENDENT
// radio groups rather than one — so nothing would deselect and arrow-key
// navigation would not move between the cards. One name per dial instance, not
// one per component: the gallery renders two dials on the same page, and a shared
// constant would let them fight over one selection.
const groupName = `gotchu-autonomy-${useId()}`;

const isLocked = id => props.lockedIds.includes(id);

const labelFor = mode => t(mode.titleKey);
const descriptionFor = mode => t(mode.descriptionKey);
</script>

<template>
  <div role="radiogroup" class="grid grid-cols-3 gap-2">
    <!-- `role="radiogroup"` on the wrapper, as the source has it. RadioCard
      renders a real `<input type="radio">`, so the group semantics come from
      `name`; the role is what tells a screen reader the three cards are one
      choice before it reaches them.

      The comment sits INSIDE the wrapper deliberately: a comment beside the root
      element makes the component a fragment, which drops `role` off
      `wrapper.element` and stops a caller's class from landing anywhere. -->

    <!-- `id` is scoped to the instance and the emitted value is `mode.id`
      regardless. RadioCard puts its `id` on a real `<input>` and its `for` on the
      wrapping label, so two dials sharing `draft`/`approve`/`handle` would put
      duplicate ids in one document and clicking the second dial's label would
      focus the first dial's input. Emitting `mode.id` rather than `$event` keeps
      that entirely inside this component — a caller never sees the scoped id. -->
    <RadioCard
      v-for="mode in MODES"
      :id="`${groupName}-${mode.id}`"
      :key="mode.id"
      :name="groupName"
      :label="labelFor(mode)"
      :description="descriptionFor(mode)"
      :is-active="value === mode.id"
      :disabled="isLocked(mode.id)"
      :disabled-label="lockTag"
      @select="$emit('select', mode.id)"
    />
  </div>
</template>
