import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SidebarGroup from '../SidebarGroup.vue';
import SidebarGroupLeaf from '../SidebarGroupLeaf.vue';
import { provideSidebarContext } from '../provider';
import { gotchuMenu } from '../gotchuMenu';

// The four queue entries share one route name, and so do the saved folders;
// this proves the sidebar still highlights only the one the open conversation
// came through. It also proves Insights keeps each report page's own
// permission gate.
const currentRoute = { name: '', path: '', params: {} };
const denied = new Set();

const PATHS = {
  queue_conversations: params => `/app/accounts/1/queue/${params.queue}`,
  all_conversations: () => '/app/accounts/1/all',
  conversation_mentions: () => '/app/accounts/1/mentions/conversations',
  procedures_list: () => '/app/accounts/1/settings/procedures',
  folder_conversations: params => `/app/accounts/1/custom_view/${params.id}`,
  account_overview_reports: () => '/app/accounts/1/reports/overview',
  conversation_reports: () => '/app/accounts/1/reports/conversation',
  agent_reports_index: () => '/app/accounts/1/reports/agents',
};

vi.mock('vue-router', () => ({
  useRoute: () => currentRoute,
  useRouter: () => ({
    // Each route's permission is its own name, so a test can deny one page.
    resolve: to => ({
      path: PATHS[to.name]?.(to.params) ?? '/',
      meta: { permissions: [to.name] },
    }),
    getRoutes: () => [],
  }),
}));

vi.mock('dashboard/composables/store', () => ({
  useMapGetter: () => ref(0),
}));

vi.mock('dashboard/composables/usePolicy', () => ({
  usePolicy: () => ({
    shouldShow: (_flag, permissions = []) =>
      !permissions.some(permission => denied.has(permission)),
  }),
}));

const REPORT_CHILDREN = [
  {
    name: 'Report Overview',
    label: 'Overview',
    to: { name: 'account_overview_reports', params: {} },
  },
  {
    name: 'Report Conversation',
    label: 'Conversation',
    to: { name: 'conversation_reports', params: {} },
  },
  {
    name: 'Reports Agent',
    label: 'Agents',
    to: { name: 'agent_reports_index', params: {} },
    activeOn: ['agent_reports_show'],
  },
];

const FOLDERS = [
  { id: 7, name: 'Refunds' },
  { id: 3, name: 'VIP' },
];

const groupNamed = groupName =>
  gotchuMenu({
    t: key => key,
    accountScopedRoute: (name, params = {}) => ({
      name,
      params: { accountId: 1, ...params },
      query: {},
    }),
    reportsGroup: { children: REPORT_CHILDREN },
    settingsGroup: { name: 'Settings', children: [] },
    helpCenterGroup: { name: 'Portals', children: [] },
    contactsTo: { name: 'contacts_dashboard_index' },
    folders: FOLDERS,
  }).find(item => item.name === groupName);

const mountGroup = (name, route, expanded = name) => {
  Object.assign(currentRoute, { params: {}, ...route });
  return mount(
    {
      components: { SidebarGroup },
      setup() {
        provideSidebarContext({
          expandedItem: ref(expanded),
          setExpandedItem: () => {},
          isCollapsed: ref(false),
          isResizing: ref(false),
        });
        return { group: groupNamed(name) };
      },
      template: '<SidebarGroup v-bind="group" />',
    },
    { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }
  );
};

const activeLeaves = (route, name = 'Queue') =>
  mountGroup(name, route)
    .findAllComponents(SidebarGroupLeaf)
    .filter(leaf => leaf.props('active'))
    .map(leaf => leaf.props('label'));

afterEach(() => denied.clear());

describe('a section the rail keeps open', () => {
  it('shows its entries while another group is the expanded one', () => {
    const leaves = mountGroup(
      'Queue',
      { name: 'agent_overview', path: '/app/accounts/1/agent' },
      'Insights'
    ).findAllComponents(SidebarGroupLeaf);
    expect(leaves.filter(leaf => leaf.isVisible()).length).toBeGreaterThan(3);
  });
});

describe('Sidebar queue entries', () => {
  it('highlights only the queue whose list is open', () => {
    expect(
      activeLeaves({
        name: 'queue_conversations',
        path: '/app/accounts/1/queue/auto_holding',
        params: { accountId: '1', queue: 'auto_holding' },
      })
    ).toEqual(['SIDEBAR.QUEUE_AUTO_HOLDING']);
  });

  it('highlights no queue on a store list, which shares the queue route', () => {
    expect(
      activeLeaves({
        name: 'queue_conversations',
        path: '/app/accounts/1/queue/store-cadeauniq',
        params: { accountId: '1', queue: 'store-cadeauniq' },
      })
    ).toEqual([]);
  });

  it('highlights only the queue a conversation was opened through', () => {
    expect(
      activeLeaves({
        name: 'conversation_through_queue',
        path: '/app/accounts/1/queue/drafted/conversations/5',
        params: { accountId: '1', queue: 'drafted', conversation_id: '5' },
      })
    ).toEqual(['SIDEBAR.QUEUE_DRAFTED']);
  });

  it('highlights All, and no queue, on a conversation opened from all', () => {
    expect(
      activeLeaves({
        name: 'inbox_conversation',
        path: '/app/accounts/1/conversations/5',
        params: { accountId: '1', conversation_id: '5' },
      })
    ).toEqual(['SIDEBAR.ALL_CONVERSATIONS']);
  });

  it('highlights only the saved folder a conversation was opened through', () => {
    expect(
      activeLeaves({
        name: 'conversations_through_folders',
        path: '/app/accounts/1/custom_view/3/conversations/5',
        params: { accountId: '1', id: '3', conversation_id: '5' },
      })
    ).toEqual(['VIP']);
  });
});

describe('Sidebar Insights entry', () => {
  it('highlights the report page that is open', () => {
    expect(
      activeLeaves(
        {
          name: 'agent_reports_show',
          path: '/app/accounts/1/reports/agents/4',
          params: { accountId: '1', id: '4' },
        },
        'Insights'
      )
    ).toEqual(['Agents']);
  });

  it('still shows the report pages an agent may open when the overview is denied', () => {
    denied.add('account_overview_reports');
    const wrapper = mountGroup('Insights', {
      name: 'conversation_reports',
      path: '/app/accounts/1/reports/conversation',
    });
    expect(wrapper.html()).not.toBe('<!--v-if-->');
    expect(
      wrapper
        .findAllComponents(SidebarGroupLeaf)
        .map(leaf => leaf.props('label'))
    ).toEqual(['Conversation', 'Agents']);
  });

  it('hides Insights only when every report page is denied', () => {
    REPORT_CHILDREN.forEach(child => denied.add(child.to.name));
    expect(
      mountGroup('Insights', { name: 'home', path: '/' }).findAllComponents(
        SidebarGroupLeaf
      )
    ).toHaveLength(0);
  });
});
