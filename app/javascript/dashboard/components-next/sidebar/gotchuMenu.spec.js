import { gotchuMenu } from './gotchuMenu';

const build = () =>
  gotchuMenu({
    t: key => key,
    accountScopedRoute: (name, params = {}) => ({ name, params }),
    reportsGroup: {
      name: 'Reports',
      children: [{ to: { name: 'account_overview_reports' } }],
    },
    settingsGroup: { name: 'Settings', children: [] },
    helpCenterGroup: { name: 'Portals', children: [] },
    contactsTo: { name: 'contacts_dashboard_index' },
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
      'procedures_list',
    ]);
  });

  it('opens Insights on the reports overview', () => {
    expect(build().find(item => item.name === 'Insights').to).toEqual({
      name: 'account_overview_reports',
    });
  });
});
