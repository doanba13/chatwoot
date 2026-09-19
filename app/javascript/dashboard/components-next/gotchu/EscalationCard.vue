<script setup>
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';

// Gotchu stopped and gave the case to a person: who has it, why it stopped, and
// what the customer was told. Ink and the neutral border, never `--g-danger` —
// an escalation is the system working, not an error, and a red card in a queue
// teaches the desk to read handovers as failures.
//
// Props only. There is no escalation record anywhere: nothing writes a reason,
// nothing marks a cycle as handed over, and the reply loop's equivalent today is
// a supporter reading a Lark thread and deciding for themselves. A truthful
// caller needs that record to exist first.
defineProps({
  // The person who has it now. DEPARTURE from the source, which defaults this to
  // `'Linh'` — a real colleague's name, on a card whose entire subject is who
  // holds the case. Required instead, following `ConfidenceChip`'s `level`: when
  // a wrong default would make a confident false claim, there is no default.
  to: {
    type: String,
    required: true,
  },
  // Why Gotchu stopped, in the caller's words. Required for the same reason: a
  // handover with no reason is the one thing this card must not render.
  reason: {
    type: String,
    required: true,
  },
  // What the customer was told. Null falls back to the source's own default
  // sentence, which lives in the catalogue rather than in a prop default so it
  // can be translated — the desk reads this in German and French.
  note: {
    type: String,
    default: null,
  },
  // One optional inline action ("Open the order", "Reassign"). Null renders no
  // button; there is no default action, and a drawn control with nothing behind
  // it is the failure `DraftDock`'s `writeEnabled` comment describes.
  actionLabel: {
    type: String,
    default: null,
  },
});

defineEmits(['action']);
</script>

<template>
  <div
    class="flex items-start gap-3 p-3 border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
  >
    <!-- 20px, the source's size. Below Avatar's 48px display-face threshold, so
      the initials render in the body face — which is right here: the name is
      repeated as text beside it, so the avatar is identification, not a
      heading. -->
    <Avatar :name="to" :size="20" />
    <div
      class="flex flex-col flex-1 min-w-0 gap-1 text-sm text-[var(--g-text)]"
    >
      <span class="text-pretty">
        <span class="font-medium">
          {{ $t('GOTCHU.ESCALATION.HANDED_TO', { name: to }) }}
        </span>
        — {{ reason }}
      </span>
      <span class="text-xs text-[var(--g-text-muted)]">
        {{ note ?? $t('GOTCHU.ESCALATION.NOTE') }}
      </span>
      <!-- A bare underlined link in the agent colour, not a `Button`: the source
        draws it as text, and it sits inside a paragraph rather than in a button
        row. `self-start` so the hit area is the words and not the whole card
        width. -->
      <button
        v-if="actionLabel"
        type="button"
        class="self-start p-0 text-xs underline bg-transparent border-0 cursor-pointer text-[var(--g-agent)]"
        @click="$emit('action')"
      >
        {{ actionLabel }}
      </button>
    </div>
  </div>
</template>
