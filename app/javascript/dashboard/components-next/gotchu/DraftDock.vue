<script setup>
import Button from 'dashboard/components-next/button/Button.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';
import ConfidenceChip from 'dashboard/components-next/gotchu/ConfidenceChip.vue';

// The band above the reply box: streaming, then ready, then gone. Exactly two
// paths out of a ready draft — insert it into the editor, or send it as it
// stands — plus discard. A third path would be a second way to approve, and
// approval is the one gesture that has to stay countable.
//
// `streaming` is a design state this build can render but cannot yet produce:
// there is no push anywhere between the worker and a browser.
defineProps({
  state: {
    type: String,
    default: 'none',
    validator: value => ['none', 'streaming', 'ready'].includes(value),
  },
  // What to say while the draft is still arriving.
  streamingText: {
    type: String,
    default: null,
  },
  text: {
    type: String,
    default: '',
  },
  // Null renders no chip. See ConfidenceChip: there is no signal to default to.
  confidence: {
    type: String,
    default: null,
  },
  // Named adjustments offered under the draft ("shorter", "warmer"). Each is
  // emitted verbatim; the dock does not know what any of them mean.
  adjust: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['insert', 'send', 'discard', 'stop', 'adjust']);
</script>

<template>
  <div
    v-if="state === 'streaming'"
    class="flex items-center justify-between gap-3 px-3 py-2 text-sm border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)] text-[var(--g-agent)]"
  >
    <span class="inline-flex items-center gap-2">
      <AgentDot streaming />
      {{ streamingText }}
    </span>
    <!-- The spine draws an `S` key here. That shortcut does not exist, and
      ReplyTopPanel already settled how this fork handles a drawn key with no
      binding behind it: name the real one, or draw none. -->
    <button
      type="button"
      class="p-0 text-xs bg-transparent border-0 cursor-pointer text-[var(--g-text-muted)]"
      @click="$emit('stop')"
    >
      {{ $t('GOTCHU.DRAFT.STOP') }}
    </button>
  </div>
  <div
    v-else-if="state === 'ready'"
    class="draft-dock flex flex-col gap-2 px-3 py-2.5 border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
  >
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 text-sm font-medium text-[var(--g-agent)]"
      >
        <AgentDot />
        {{ $t('GOTCHU.DRAFT.TITLE') }}
      </span>
      <ConfidenceChip v-if="confidence" :level="confidence" />
    </div>
    <div class="text-sm text-pretty text-[var(--g-text)]">{{ text }}</div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2">
        <Button
          color="teal"
          variant="outline"
          size="sm"
          :label="$t('GOTCHU.DRAFT.INSERT')"
          @click="$emit('insert')"
        />
        <Button
          color="teal"
          variant="outline"
          size="sm"
          :label="$t('GOTCHU.DRAFT.SEND')"
          @click="$emit('send')"
        />
        <Button
          color="slate"
          variant="ghost"
          size="sm"
          :label="$t('GOTCHU.DRAFT.DISCARD')"
          @click="$emit('discard')"
        />
      </div>
      <span
        v-if="adjust.length"
        class="inline-flex flex-wrap items-center gap-1.5 text-xs text-[var(--g-text-muted)]"
      >
        {{ $t('GOTCHU.DRAFT.ADJUST') }}
        <button
          v-for="option in adjust"
          :key="option"
          type="button"
          class="p-0 text-xs bg-transparent border-0 cursor-pointer text-[var(--g-agent)]"
          @click="$emit('adjust', option)"
        >
          {{ option }}
        </button>
      </span>
    </div>
  </div>
</template>

<style scoped>
.draft-dock {
  animation: g-in var(--g-dur-arrive) var(--g-ease-out);
}
</style>
