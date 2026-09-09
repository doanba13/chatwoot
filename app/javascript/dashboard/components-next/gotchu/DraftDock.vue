<script setup>
import { computed, ref } from 'vue';

import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';
import ConfidenceChip from 'dashboard/components-next/gotchu/ConfidenceChip.vue';

// The band above the reply box: streaming, then ready, then gone. Exactly two
// paths out of a ready draft — insert it into the editor, or send it as it
// stands — plus discard. A third path would be a second way to approve, and
// approval is the one gesture that has to stay countable.
//
// `streaming` is a design state this build can render but cannot yet produce:
// there is no push anywhere between the worker and a browser.
const props = defineProps({
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

const emit = defineEmits([
  'insert',
  'send',
  'discard',
  'stop',
  'adjust',
  'instruct',
]);

// Free text to the agent, and only ever that. Typing "send it" here emits
// `instruct` like anything else — the dock has no path from a typed string to
// `send`, which is the whole of invariant 5 expressed as a component: a
// classifier can be wrong about what a sentence meant, a button press cannot.
const instruction = ref('');

const submitInstruction = () => {
  const text = instruction.value.trim();
  if (!text) return;
  emit('instruct', text);
  instruction.value = '';
};

// Streaming and ready share one header row — same height, same dot, same
// position — so becoming ready reveals a body under a header that has not
// moved, rather than swapping one band for a differently shaped one.
const isStreaming = computed(() => props.state === 'streaming');
</script>

<template>
  <div
    v-if="state !== 'none'"
    class="draft-dock flex flex-col gap-2 px-3 py-2.5 border-b bg-[var(--g-surface-tank)] border-[var(--g-agent-border)]"
  >
    <div class="flex items-center justify-between gap-3">
      <span
        class="inline-flex items-center gap-2 text-sm font-medium text-[var(--g-agent)]"
      >
        <AgentDot :streaming="isStreaming" />
        {{ isStreaming ? streamingText : $t('GOTCHU.DRAFT.TITLE') }}
      </span>
      <!-- The spine draws an `S` key beside this. That shortcut does not exist,
        and ReplyTopPanel already settled how this fork handles a drawn key with
        no binding behind it: name the real one, or draw none. -->
      <button
        v-if="isStreaming"
        type="button"
        class="p-0 text-xs transition-colors bg-transparent border-0 cursor-pointer duration-[var(--g-dur-hover)] text-[var(--g-text-muted)] hover:text-[var(--g-text)]"
        @click="$emit('stop')"
      >
        {{ $t('GOTCHU.DRAFT.STOP') }}
      </button>
      <ConfidenceChip v-else-if="confidence" :level="confidence" />
    </div>
    <!-- The body is mounted only once the draft is ready, rather than revealed
      from a collapsed shell: a shell keeps Send draft in the DOM while the
      draft is still arriving, where it is one Tab away from sending a reply
      nobody has read. A header that does not move is worth an animation; a
      reachable send button is not. -->
    <template v-if="!isStreaming">
      <div class="text-sm text-pretty text-[var(--g-text)]">{{ text }}</div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex gap-2">
          <!-- These two were the same button twice — same colour, same
            variant, same size — and only one of them reaches a customer.
            Insert puts the draft in the editor and is reversible; Send draft
            is not. So Send is the solid one, and each carries its own glyph:
            an arrow into the composer, and a paper plane out. -->
          <Button
            color="teal"
            variant="outline"
            size="sm"
            icon="i-lucide-corner-down-left"
            :label="$t('GOTCHU.DRAFT.INSERT')"
            @click="$emit('insert')"
          />
          <Button
            color="teal"
            variant="solid"
            size="sm"
            icon="i-lucide-send"
            :label="$t('GOTCHU.DRAFT.SEND')"
            @click="$emit('send')"
          />
          <!-- `link`, not the spine's `ghost`: Chatwoot's slate ghost is
            `text-n-slate-12`, the strongest text on the card, which made discard
            the loudest label in the dock and louder still in dark mode. Slate
            link is the muted one, and dropping the box leaves the two paths that
            reach a customer as the only things shaped like buttons. -->
          <Button
            color="slate"
            variant="link"
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
          <!-- The middots are the spine's: with gaps alone, three adjustments
            read as one phrase rather than three separate things to press. -->
          <template v-for="(option, index) in adjust" :key="option">
            <span v-if="index" aria-hidden="true">·</span>
            <button
              type="button"
              class="p-0 text-xs transition-colors bg-transparent border-0 cursor-pointer duration-[var(--g-dur-hover)] text-[var(--g-agent)] hover:underline"
              @click="$emit('adjust', option)"
            >
              {{ option }}
            </button>
          </template>
        </span>
      </div>
      <!-- The adjustments above are shortcuts for the common cases; this is the
        channel the desk actually works in. Every instruction the reply loop
        handles today arrives as German or French prose in a Lark thread, so a
        dock with only fixed chips cannot express "add the tracking number
        first" — and that instruction is precisely the one the deployed model
        mis-reads as a send. Here it cannot be one. -->
      <div class="flex items-center gap-2">
        <Input
          v-model="instruction"
          size="sm"
          class="flex-1 min-w-0"
          custom-input-class="!bg-[var(--g-surface)]"
          :placeholder="$t('GOTCHU.DRAFT.INSTRUCT_PLACEHOLDER')"
          @enter="submitInstruction"
        />
        <Button
          color="teal"
          variant="outline"
          size="sm"
          icon="i-lucide-arrow-up"
          :aria-label="$t('GOTCHU.DRAFT.INSTRUCT_SUBMIT')"
          :disabled="!instruction.trim()"
          @click="submitInstruction"
        />
      </div>
    </template>
  </div>
</template>

<style scoped>
.draft-dock {
  animation: g-in var(--g-dur-arrive) var(--g-ease-out);
}
</style>
