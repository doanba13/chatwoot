import { h } from 'vue';
import { QUEUES } from '../gotchu/queues';

const CHANNEL_ICONS = {
  email: 'i-lucide-mail',
  messenger: 'i-lucide-message-circle',
  web: 'i-lucide-globe',
};

// A store's dot, --g-store-1..5 by position: the order storeIndex uses. A
// VNode, as the sidebar's other drawn icons are (SidebarProfileMenuStatus):
// the entries' icon props take a class string or a VNode, not a function.
// The rail sizes an icon to its 16 px box, so the 8 px dot sits inside one.
const storeDot = index =>
  h('span', { class: 'inline-flex items-center justify-center' }, [
    h('span', {
      class: 'inline-block size-2 rounded-full',
      style: { background: `var(--g-store-${(index % 5) + 1})` },
    }),
  ]);

// Stores and inboxes (board 1): each store routes to its own conversations
// and expands to its mapped inboxes, then the account's unmapped email inbox
// (the shared Support Mail) as "Email, via …". The unmapped inboxes follow
// the stores, labelled with their own name and "all stores". A store with no
// inbox the signed-in agent can see is a plain entry, so it does not vanish.
const storesGroup = ({ t, accountScopedRoute, stores, inboxes }) => {
  const mapped = new Set(stores.flatMap(s => s.inboxes.map(i => i.id)));
  const nameOf = id => inboxes.find(i => i.id === id)?.name ?? `#${id}`;
  const unmapped = inboxes.filter(i => !mapped.has(i.id));
  const inboxRoute = id =>
    accountScopedRoute('inbox_dashboard', { inbox_id: id });
  const storeEntries = stores.map((store, index) => {
    const own = store.inboxes.map(inbox => ({
      name: `store-${store.key}-inbox-${inbox.id}`,
      label: nameOf(inbox.id),
      icon: CHANNEL_ICONS[inbox.channel] ?? 'i-lucide-inbox',
      to: inboxRoute(inbox.id),
    }));
    const shared = unmapped
      .filter(inbox => inbox.channel === 'email')
      .map(inbox => ({
        name: `store-${store.key}-shared-${inbox.id}`,
        label: t('SIDEBAR.EMAIL_VIA_SHARED', { name: inbox.name }),
        icon: CHANNEL_ICONS.email,
        to: inboxRoute(inbox.id),
        shared: true,
      }));
    const children = [...own, ...shared];
    return {
      name: `store-${store.key}`,
      label: store.name,
      icon: storeDot(index),
      to: accountScopedRoute('queue_conversations', {
        queue: `store-${store.key}`,
      }),
      ...(children.length ? { children, collapsible: true } : {}),
    };
  });
  const sharedEntries = unmapped.map(inbox => ({
    name: `shared-${inbox.id}`,
    label: inbox.name,
    sublabel: t('SIDEBAR.ALL_STORES'),
    icon: CHANNEL_ICONS[inbox.channel] ?? 'i-lucide-inbox',
    to: inboxRoute(inbox.id),
  }));
  return {
    name: 'Stores',
    label: t('SIDEBAR.STORES'),
    icon: 'i-lucide-store',
    open: true,
    children: [...storeEntries, ...sharedEntries],
  };
};

// The rail, agent first (spec 2026-10-03 §4). Chatwoot's Inbox, Captain,
// Calls, Companies and Campaigns are deliberately absent; the spec beside
// this file fails if one comes back.
//
// The four queue entries share one route and one activeOn list. SidebarGroup
// tells them apart by ranking activeOn matches on `to.params`, so it is the
// `queue` param each entry carries that highlights only its own queue.
export function gotchuMenu({
  t,
  accountScopedRoute,
  reportsGroup,
  settingsGroup,
  helpCenterGroup,
  contactsTo,
  folders = [],
  counts = {},
  stores = [],
  inboxes = [],
}) {
  // A count that could not be read is undefined, and renders no badge.
  const queueCounts = counts.queue ?? {};
  return [
    // Agent, Queue and Stores are sections the rail keeps open together, as
    // every board draws them (SidebarGroup's `open`); the rest keep the
    // accordion.
    {
      name: 'Agent',
      label: t('SIDEBAR.AGENT'),
      icon: 'i-lucide-sparkles',
      open: true,
      children: [
        {
          name: 'Overview',
          label: t('SIDEBAR.AGENT_OVERVIEW'),
          icon: 'i-lucide-target',
          to: accountScopedRoute('agent_overview'),
          activeOn: ['agent_overview'],
        },
        {
          name: 'Procedures',
          label: t('SIDEBAR.PROCEDURES'),
          icon: 'i-lucide-list-checks',
          to: accountScopedRoute('agent_procedures'),
          activeOn: [
            'agent_procedures',
            'agent_procedure_new',
            'agent_procedure',
          ],
          badgeCount: counts.procedures,
          badgeTone: 'muted',
        },
        {
          name: 'Rules',
          label: t('SIDEBAR.RULES'),
          icon: 'i-lucide-sliders-horizontal',
          to: accountScopedRoute('agent_rules'),
          activeOn: ['agent_rules', 'agent_rule_new', 'agent_rule'],
          badgeCount: counts.rules,
          badgeTone: 'muted',
        },
        {
          name: 'Memos',
          label: t('SIDEBAR.MEMOS'),
          icon: 'i-lucide-bookmark',
          to: accountScopedRoute('agent_memos'),
          activeOn: ['agent_memos', 'agent_memo_new', 'agent_memo'],
          badgeCount: counts.memosPending,
          badgeTone: 'hot',
        },
      ],
    },
    {
      name: 'Queue',
      label: t('SIDEBAR.QUEUE'),
      icon: 'i-lucide-message-circle',
      open: true,
      children: [
        ...QUEUES.map(queue => ({
          name: queue.key,
          // QUEUES holds i18n keys; each one exists in en/settings.json.
          // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
          label: t(queue.label),
          icon: queue.icon,
          to: accountScopedRoute('queue_conversations', { queue: queue.key }),
          activeOn: ['queue_conversations', 'conversation_through_queue'],
          // Every queue is counted, as the boards draw them; Needs you is the
          // hot count.
          badgeCount: queueCounts[queue.key],
          badgeTone: queue.mineOrUnassigned ? 'hot' : 'muted',
        })),
        {
          name: 'All',
          label: t('SIDEBAR.ALL_CONVERSATIONS'),
          icon: 'i-lucide-inbox',
          to: accountScopedRoute('all_conversations'),
          activeOn: ['all_conversations', 'inbox_conversation'],
        },
        {
          name: 'Mentions',
          label: t('SIDEBAR.MENTIONED_CONVERSATIONS'),
          icon: 'i-lucide-at-sign',
          to: accountScopedRoute('conversation_mentions'),
          activeOn: ['conversation_through_mentions'],
        },
        // Saved folders, as the old Conversation > Folders group built them.
        ...folders.map(view => ({
          name: `${view.name}-${view.id}`,
          label: view.name,
          icon: 'i-lucide-folder',
          to: accountScopedRoute('folder_conversations', { id: view.id }),
          activeOn: ['conversations_through_folders'],
        })),
      ],
    },
    storesGroup({ t, accountScopedRoute, stores, inboxes }),
    // Until the per-procedure Insights page exists, Insights is Chatwoot's
    // report pages, passed through unchanged so each keeps its own permission
    // gate: an agent allowed some reports but not the overview still sees them.
    {
      name: 'Insights',
      label: t('SIDEBAR.INSIGHTS'),
      icon: 'i-lucide-chart-spline',
      children: reportsGroup.children,
    },
    {
      name: 'Customers',
      label: t('SIDEBAR.CUSTOMERS'),
      icon: 'i-lucide-contact',
      to: contactsTo,
      activeOn: [
        'contacts_dashboard_index',
        'contacts_dashboard_active',
        'contacts_dashboard_segments_index',
        'contacts_dashboard_labels_index',
        'contacts_edit',
        'contacts_edit_segment',
        'contacts_edit_label',
      ],
    },
    helpCenterGroup,
    settingsGroup,
  ];
}
