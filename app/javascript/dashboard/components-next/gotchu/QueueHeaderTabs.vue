<script setup>
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useIntervalFn } from '@vueuse/core';

import ConversationApi from 'dashboard/api/inbox/conversation';
import { queueFolder, queueTabs } from './queues';

// All · Drafts · Handed over under a queue's header, each with a count. A
// count is the conversation filter's own `all_count` for that tab's query;
// one that could not be read renders no number, never 0.
const props = defineProps({
  queueKey: { type: String, required: true },
  userId: { type: Number, default: null },
});
const tab = defineModel({ type: String, default: 'all' });

const { t } = useI18n();
const counts = ref({});

const tabs = computed(() => queueTabs(props.queueKey));

const countFor = async key => {
  const folder = queueFolder(props.queueKey, t, props.userId, key);
  if (!folder) return undefined;
  try {
    const { data } = await ConversationApi.filter({
      queryData: folder.query,
      page: 1,
    });
    const n = data?.meta?.all_count;
    return Number.isInteger(n) ? n : undefined;
  } catch {
    return undefined;
  }
};

const loadCounts = async () => {
  const queueKey = props.queueKey;
  const entries = await Promise.all(
    tabs.value.map(async x => [x.key, await countFor(x.key)])
  );
  // A queue switched while the counts were in flight keeps its own.
  if (queueKey === props.queueKey) counts.value = Object.fromEntries(entries);
};

watch(
  () => [props.queueKey, props.userId],
  () => {
    counts.value = {};
    if (tabs.value.length > 1) loadCounts();
  },
  { immediate: true }
);
useIntervalFn(() => {
  if (tabs.value.length > 1) loadCounts();
}, 60000);
</script>

<template>
  <div
    v-if="tabs.length > 1"
    class="flex items-center gap-4 px-4 border-b border-[var(--g-border)]"
    role="tablist"
    data-testid="queue-tabs"
  >
    <button
      v-for="x in tabs"
      :key="x.key"
      type="button"
      role="tab"
      class="inline-flex items-center gap-1.5 py-2 -mb-px text-sm font-medium bg-transparent border-0 border-b-2"
      :class="
        tab === x.key
          ? 'border-[var(--g-text)] text-[var(--g-text)]'
          : 'border-transparent text-[var(--g-text-muted)]'
      "
      :aria-selected="tab === x.key"
      :data-testid="`queue-tab-${x.key}`"
      @click="tab = x.key"
    >
      {{ t(x.label) }}
      <span
        v-if="counts[x.key] !== undefined"
        class="text-xs text-[var(--g-text-muted)]"
      >
        {{ counts[x.key] }}
      </span>
    </button>
  </div>
</template>
