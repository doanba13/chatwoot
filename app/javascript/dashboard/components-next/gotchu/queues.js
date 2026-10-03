// The desk's four built-in queues, as virtual folders over Chatwoot's own
// conversation filter. `gotchu_state` is written by the reply worker and is a
// display hint only: a queue is a view, never a decision.
export const QUEUES = [
  {
    key: 'needs_you',
    label: 'SIDEBAR.QUEUE_NEEDS_YOU',
    icon: 'i-lucide-clock',
    states: ['drafted', 'handed_over'],
  },
  {
    key: 'drafted',
    label: 'SIDEBAR.QUEUE_DRAFTED',
    icon: 'i-lucide-pencil-line',
    states: ['drafted'],
  },
  {
    key: 'auto_holding',
    label: 'SIDEBAR.QUEUE_AUTO_HOLDING',
    icon: 'i-lucide-check',
    states: ['auto_holding'],
  },
  {
    key: 'handed_over',
    label: 'SIDEBAR.QUEUE_HANDED_OVER',
    icon: 'i-lucide-hand',
    states: ['handed_over'],
  },
];

// The same shape a saved folder stores. One state per condition, because the
// backend keeps only the FIRST value of a multi-value custom-attribute match
// (FilterService#string_filter_values). Each state carries its own status
// condition, because conditions are joined with AND binding tighter than OR,
// so "open and a or open and b" is how "open and (a or b)" has to be spelled.
const payloadFor = states =>
  states.flatMap((state, index) => [
    {
      attribute_key: 'status',
      filter_operator: 'equal_to',
      values: ['open'],
      query_operator: 'and',
    },
    {
      attribute_key: 'gotchu_state',
      filter_operator: 'equal_to',
      values: [state],
      query_operator: index === states.length - 1 ? null : 'or',
    },
  ]);

export function queueFolder(key, t) {
  const queue = QUEUES.find(q => q.key === key);
  if (!queue) return undefined;
  return {
    id: `queue:${queue.key}`,
    name: t(queue.label),
    query: { payload: payloadFor(queue.states) },
  };
}
