<script setup>
import Icon from 'dashboard/components-next/icon/Icon.vue';
import Label from 'dashboard/components-next/label/Label.vue';
import Switch from 'dashboard/components-next/switch/Switch.vue';

// One row per contact reason — "Where is my order", "Wrong size", "Refund" — and
// a switch saying whether Gotchu answers it end to end. Teal when it does, which
// is what `Switch`'s `agent` prop is for.
//
// Props only. There is no per-topic configuration anywhere: topics are not a
// concept in this system, nothing classifies a conversation into one, and the
// reply loop drafts for everything that reaches it. `AutonomyDial`'s third mode
// ("handle selected topics") is the thing that would need this list, and it does
// not exist either.
defineProps({
  // `{ id, name, meta, on, handler? }` each. `on` is THREE-valued and that is the
  // component: `true` and `false` are a switch, and `null` means the topic is not
  // switchable at all — it always goes to a person — so it renders a chip instead
  // of a switch that could be moved. A missing `on` is not the same as `null` and
  // is not handled specially: `undefined` is falsy, so it renders an off switch,
  // which is the source's behaviour.
  topics: {
    type: Array,
    default: () => [],
  },
});

defineEmits(['toggle']);
</script>

<template>
  <div
    class="overflow-hidden border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
  >
    <div
      v-for="(topic, index) in topics"
      :key="topic.id"
      class="topic-switch__row flex items-center gap-3 px-3.5 py-3 box-border min-h-[var(--g-hit)]"
      :class="index ? 'border-t border-[var(--g-border)]' : ''"
    >
      <div class="flex flex-col flex-1 min-w-0">
        <span class="text-sm text-[var(--g-text)]">{{ topic.name }}</span>
        <!-- The meta line carries the state in colour as well as in words: agent
          teal when Gotchu handles it, muted otherwise. `topic.on` is the test, so
          the `null` row is muted — which is correct, because a row that always
          hands over is not something Gotchu is doing. -->
        <span
          class="topic-switch__meta text-xs truncate"
          :class="
            topic.on ? 'text-[var(--g-agent)]' : 'text-[var(--g-text-muted)]'
          "
        >
          {{ topic.meta }}
        </span>
      </div>
      <!-- `=== null` and not a falsy test: `false` is a switched-off topic and
        must still render a switch. -->
      <Label
        v-if="topic.on === null"
        color="neutral"
        compact
        :label="topic.handler || $t('GOTCHU.TOPICS.ALWAYS_HANDS_OVER')"
      >
        <template #icon>
          <Icon icon="i-lucide-users" class="flex-shrink-0 size-3" />
        </template>
      </Label>
      <!-- `:model-value` WITH `@update:model-value`, which is what keeps this
        switch controlled. `Switch` uses `defineModel`, and Vue's `useModel` only
        skips its internal local copy when the prop and its update listener are
        BOTH present — pass the prop alone and the switch flips itself, which is
        wrong for a list whose state lives in the caller.
        `update:model-value` rather than Switch's own `change` event for the same
        structural reason: `change` is emitted after the local write, so in the
        uncontrolled case it reports the value the switch just left rather than the
        one it moved to. `update:model-value` always carries the new value. -->
      <Switch
        v-else
        agent
        :model-value="!!topic.on"
        @update:model-value="$emit('toggle', topic.id, $event)"
      />
    </div>
  </div>
</template>
