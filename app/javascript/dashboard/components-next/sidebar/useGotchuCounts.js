// The rail's counts: procedures, active rules and pending memo proposals
// from the Agent overview, and each queue from the conversation filter's own
// `all_count`, as the boards draw them. A read that fails leaves its count undefined, and an undefined
// count renders no badge, never 0. Display only.
import { onMounted, ref } from 'vue';
import { useIntervalFn } from '@vueuse/core';

import AgentAPI from 'dashboard/api/gotchu/agent';
import ConversationApi from 'dashboard/api/inbox/conversation';
import { QUEUES, queueFolder } from 'dashboard/components-next/gotchu/queues';

export function useGotchuCounts({ t, userId }) {
  const counts = ref({ queue: {} });

  const overviewCounts = async () => {
    try {
      const { data } = await AgentAPI.overview(7);
      if (data?.capabilities?.overview !== true) return {};
      return {
        procedures: data.procedures?.length,
        rules: data.rulesActive,
        memosPending: data.proposalsPending,
      };
    } catch {
      return {};
    }
  };

  const queueCount = async key => {
    const folder = queueFolder(key, t, userId.value);
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

  const load = async () => {
    const [agent, ...queues] = await Promise.all([
      overviewCounts(),
      ...QUEUES.map(queue => queueCount(queue.key)),
    ]);
    counts.value = {
      ...agent,
      queue: Object.fromEntries(
        QUEUES.map((queue, i) => [queue.key, queues[i]])
      ),
    };
  };

  onMounted(load);
  useIntervalFn(load, 60000);

  return { counts, load };
}
