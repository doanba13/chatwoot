<script setup>
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useMapGetter, useStore } from 'dashboard/composables/store';
import { dateFormat } from 'shared/helpers/timeHelper';

import SidePanel from 'dashboard/components-next/side-panel/SidePanel.vue';

// A procedure's revisions, newest first, read-only. The editor opens it
// through `open()` on a template ref, the way SidePanel itself opens.
const props = defineProps({
  revisions: { type: Array, default: () => [] },
});

const { t } = useI18n();
const store = useStore();
const agents = useMapGetter('agents/getAgents');
const panel = ref(null);

// `chatwoot:<id>` is a person on this desk; anything else (cli:, a Lark-era
// id) is shown as it was recorded.
const authorName = author => {
  const person = /^chatwoot:(\d+)$/.exec(author ?? '');
  if (!person) return author ?? '';
  const agent = (agents.value ?? []).find(a => String(a.id) === person[1]);
  return agent?.name ?? author;
};

const rows = computed(() =>
  [...props.revisions]
    .sort((a, b) => b.version - a.version)
    .map(r => ({
      version: r.version,
      title: r.title,
      date: r.createdAt
        ? dateFormat(Math.floor(Date.parse(r.createdAt) / 1000))
        : '',
      author: authorName(r.createdBy),
    }))
);

onMounted(() => store.dispatch('agents/get'));

defineExpose({ open: () => panel.value?.open() });
</script>

<template>
  <SidePanel ref="panel" :title="t('GOTCHU_AGENT.PROCEDURE.HISTORY')">
    <ol class="flex flex-col gap-2 p-0 m-0 list-none">
      <li
        v-for="row in rows"
        :key="row.version"
        class="text-sm text-[var(--g-text)]"
        :data-testid="`history-v${row.version}`"
      >
        {{ t('GOTCHU_AGENT.PROCEDURE.HISTORY_ROW', row) }}
      </li>
    </ol>
  </SidePanel>
</template>
