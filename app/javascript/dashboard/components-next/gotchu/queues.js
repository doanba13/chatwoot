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

// A store in the rail is a virtual folder over the conversation's
// `store_key`, routed through the queue route as `store-<key>`. The filter
// can query it because `store_key` is a declared attribute
// (Gotchu::QueueAttributes). Display routing only.
export const STORE_QUEUE_PREFIX = 'store-';

// `<key>-inbox-<id>` is one store's mail in one inbox: the rail's "Email, via
// Support Mail" under that store, which would otherwise open the whole shared
// inbox from every store.
const STORE_INBOX = /^(.+)-inbox-(\d+)$/;
export const storeInboxQueue = (key, inboxId) =>
  `${STORE_QUEUE_PREFIX}${key}-inbox-${inboxId}`;

export function storeFolder(param) {
  if (!param) return undefined;
  const [, key = param, inboxId] = param.match(STORE_INBOX) ?? [];
  const rows = [condition('store_key', 'equal_to', [key])];
  if (inboxId) rows.push(condition('inbox_id', 'equal_to', [Number(inboxId)]));
  return {
    id: `store:${param}`,
    name: key,
    query: {
      payload: rows.map((row, i) =>
        i === rows.length - 1 ? { ...row, query_operator: null } : row
      ),
    },
  };
}

// The tabs under a queue's header (board 1): All · Drafts · Handed over.
// Each narrows the queue by `gotchu_state`, never widens it.
export const QUEUE_TABS = [
  { key: 'all', label: 'CONVERSATION.GOTCHU_QUEUE.TAB_ALL', states: null },
  {
    key: 'drafts',
    label: 'CONVERSATION.GOTCHU_QUEUE.TAB_DRAFTS',
    states: ['drafted'],
  },
  {
    key: 'handed_over',
    label: 'CONVERSATION.GOTCHU_QUEUE.TAB_HANDED_OVER',
    states: ['handed_over'],
  },
];

// The states a queue shows under a tab: the queue's own, narrowed by the
// tab's. Empty when the tab has nothing in this queue.
export function filtersFor(queueKey, tab = 'all') {
  const queue = QUEUES.find(q => q.key === queueKey);
  const narrow = QUEUE_TABS.find(x => x.key === tab);
  if (!queue || !narrow) return [];
  if (!narrow.states) return [...queue.states];
  return queue.states.filter(state => narrow.states.includes(state));
}

// Only the tabs that leave something to show; a queue with one state has
// nothing to narrow, so it gets All alone and the bar is not drawn.
export const queueTabs = queueKey =>
  QUEUE_TABS.filter(tab => filtersFor(queueKey, tab.key).length > 0);

// An empty state list would build an empty filter, which matches every
// conversation, so a tab with nothing in this queue answers no folder at all.
export function queueFolder(key, t, userId, tab = 'all') {
  const queue = QUEUES.find(q => q.key === key);
  if (!queue) return undefined;
  const states = filtersFor(key, tab);
  if (!states.length) return undefined;
  return {
    id: `queue:${queue.key}`,
    name: t(queue.label),
    query: {
      payload: payloadFor(states, queue.mineOrUnassigned ? userId : null),
    },
  };
}

// Whether two active folders show the same list. ChatList's folder is rebuilt
// from the signed-in user, whose object is replaced on every presence tick, and
// a refetch empties the conversation list -- so "a new object" must not count
// as "a new folder".
const folderKey = folder =>
  folder
    ? JSON.stringify([folder.id, folder.name, folder.query ?? null])
    : null;
export const sameFolder = (a, b) => folderKey(a) === folderKey(b);
