import { QUEUES } from '../gotchu/queues';

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
}) {
  return [
    {
      name: 'Agent',
      label: t('SIDEBAR.AGENT'),
      icon: 'i-lucide-sparkles',
      children: [
        {
          name: 'Procedures',
          label: t('SIDEBAR.PROCEDURES'),
          icon: 'i-lucide-list-checks',
          to: accountScopedRoute('procedures_list'),
          activeOn: ['procedures_list', 'procedures_new', 'procedures_edit'],
        },
      ],
    },
    {
      name: 'Queue',
      label: t('SIDEBAR.QUEUE'),
      icon: 'i-lucide-message-circle',
      children: [
        ...QUEUES.map(queue => ({
          name: queue.key,
          // QUEUES holds i18n keys; each one exists in en/settings.json.
          // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
          label: t(queue.label),
          icon: queue.icon,
          to: accountScopedRoute('queue_conversations', { queue: queue.key }),
          activeOn: ['queue_conversations', 'conversation_through_queue'],
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
