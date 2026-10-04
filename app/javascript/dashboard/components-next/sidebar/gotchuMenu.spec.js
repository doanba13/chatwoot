import { gotchuMenu } from './gotchuMenu';

const REPORT_CHILDREN = [
  { name: 'Report Overview', to: { name: 'account_overview_reports' } },
  { name: 'Report Conversation', to: { name: 'conversation_reports' } },
  {
    name: 'Reports Agent',
    to: { name: 'agent_reports_index' },
    activeOn: ['agent_reports_show'],
  },
];

const build = (over = {}) =>
  gotchuMenu({
    t: key => key,
    accountScopedRoute: (name, params = {}) => ({ name, params }),
    reportsGroup: { name: 'Reports', children: REPORT_CHILDREN },
    settingsGroup: { name: 'Settings', children: [] },
    helpCenterGroup: { name: 'Portals', children: [] },
    contactsTo: { name: 'contacts_dashboard_index' },
    folders: [],
    ...over,
  });

describe('gotchuMenu', () => {
  it('opens on the agent and its queue, in that order', () => {
    expect(build().map(item => item.name)).toEqual([
      'Agent',
      'Queue',
      'Insights',
      'Customers',
      'Portals',
      'Settings',
    ]);
  });

  it('never carries a Chatwoot paid or out-of-scope surface', () => {
    const names = JSON.stringify(build());
    ['Captain', 'Calls', 'Companies', 'Campaigns', '"Inbox"'].forEach(name =>
      expect(names).not.toContain(name)
    );
  });

  it('puts the four queues first in Queue, then all conversations and mentions', () => {
    const queue = build().find(item => item.name === 'Queue');
    expect(queue.children.map(child => child.name)).toEqual([
      'needs_you',
      'drafted',
      'auto_holding',
      'handed_over',
      'All',
      'Mentions',
    ]);
    expect(queue.children[0].to).toEqual({
      name: 'queue_conversations',
      params: { queue: 'needs_you' },
    });
  });

  it('gives each queue its own queue param, which is what tells them apart when active', () => {
    const queue = build().find(item => item.name === 'Queue');
    const queues = queue.children.slice(0, 4);
    expect(queues.map(child => child.to.params.queue)).toEqual([
      'needs_you',
      'drafted',
      'auto_holding',
      'handed_over',
    ]);
    queues.forEach(child =>
      expect(child.activeOn).toEqual([
        'queue_conversations',
        'conversation_through_queue',
      ])
    );
  });

  it('lists procedures under Agent, not under Settings', () => {
    const agent = build().find(item => item.name === 'Agent');
    expect(agent.children.map(child => child.to.name)).toEqual([
      'agent_overview',
      'agent_procedures',
      'agent_rules',
      'agent_memos',
    ]);
  });

  it('lists Overview, Procedures, Rules and Memos under Agent, and no Replay', () => {
    const agent = build().find(group => group.name === 'Agent');
    expect(agent.children.map(c => c.name)).toEqual([
      'Overview',
      'Procedures',
      'Rules',
      'Memos',
    ]);
    expect(agent.children[1].activeOn).toEqual([
      'agent_procedures',
      'agent_procedure_new',
      'agent_procedure',
    ]);
  });

  it('opens Insights on the reports overview and keeps every report page under it', () => {
    const insights = build().find(item => item.name === 'Insights');
    expect(insights.label).toBe('SIDEBAR.INSIGHTS');
    expect(insights.to).toBeUndefined();
    expect(insights.children[0].to).toEqual({
      name: 'account_overview_reports',
    });
    // The report entries pass through untouched, so SidebarGroup still gates
    // each page on its own route permissions, and highlights Insights on any.
    expect(insights.children).toEqual(REPORT_CHILDREN);
  });

  it('carries the saved folders after Mentions, in the order given', () => {
    const queue = build({
      folders: [
        { id: 7, name: 'Refunds' },
        { id: 3, name: 'VIP' },
      ],
    }).find(item => item.name === 'Queue');
    expect(queue.children.slice(6)).toEqual([
      {
        name: 'Refunds-7',
        label: 'Refunds',
        icon: 'i-lucide-folder',
        to: { name: 'folder_conversations', params: { id: 7 } },
        activeOn: ['conversations_through_folders'],
      },
      {
        name: 'VIP-3',
        label: 'VIP',
        icon: 'i-lucide-folder',
        to: { name: 'folder_conversations', params: { id: 3 } },
        activeOn: ['conversations_through_folders'],
      },
    ]);
  });

  it('adds no folder entries when there are no saved folders', () => {
    const queue = build().find(item => item.name === 'Queue');
    expect(queue.children.at(-1).name).toBe('Mentions');
  });

  it('highlights Customers on every contact page', () => {
    const customers = build().find(item => item.name === 'Customers');
    expect(customers.activeOn).toEqual([
      'contacts_dashboard_index',
      'contacts_dashboard_active',
      'contacts_dashboard_segments_index',
      'contacts_dashboard_labels_index',
      'contacts_edit',
      'contacts_edit_segment',
      'contacts_edit_label',
    ]);
  });
});
