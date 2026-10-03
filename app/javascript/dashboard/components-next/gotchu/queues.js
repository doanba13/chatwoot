// The desk's four built-in queues, as virtual folders over Chatwoot's own
// conversation filter. `gotchu_state` is written by the reply worker and is a
// display hint only: a queue is a view, never a decision.
export const QUEUES = [
  {
    key: 'needs_you',
    label: 'SIDEBAR.QUEUE_NEEDS_YOU',
    icon: 'i-lucide-clock',
    states: ['drafted', 'handed_over'],
    // The only queue scoped to a person; the other three are account-wide.
    mineOrUnassigned: true,
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
//
// Needs you is "unassigned or assigned to me" (spec 6.3), so it repeats each
// state once per assignee case: open and s and assignee=me, or open and s and
// no assignee. `assignee_id is_not_present` is the backend's own "no human and
// no bot assignee" (FilterHelper#assignee_presence_filter), and the in-memory
// filter reads the same field off `meta.assignee`. The id is sent as a number:
// a string would be lower-cased as a custom-attribute value on the backend.
const condition = (attributeKey, filterOperator, values) => ({
  attribute_key: attributeKey,
  filter_operator: filterOperator,
  values,
  query_operator: 'and',
});

const groupsFor = (states, userId) =>
  states.flatMap(state => {
    const base = [
      condition('status', 'equal_to', ['open']),
      condition('gotchu_state', 'equal_to', [state]),
    ];
    if (!userId) return [base];
    return [
      [...base, condition('assignee_id', 'equal_to', [userId])],
      [...base, condition('assignee_id', 'is_not_present', [])],
    ];
  });

// AND inside a group, OR between groups, nothing after the last condition.
const payloadFor = (states, userId) => {
  const groups = groupsFor(states, userId);
  return groups.flatMap((group, groupIndex) =>
    group.map((row, rowIndex) => {
      if (rowIndex < group.length - 1) return row;
      return {
        ...row,
        query_operator: groupIndex === groups.length - 1 ? null : 'or',
      };
    })
  );
};

export function queueFolder(key, t, userId) {
  const queue = QUEUES.find(q => q.key === key);
  if (!queue) return undefined;
  return {
    id: `queue:${queue.key}`,
    name: t(queue.label),
    query: {
      payload: payloadFor(queue.states, queue.mineOrUnassigned ? userId : null),
    },
  };
}
