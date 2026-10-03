import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import SidebarGroup from '../SidebarGroup.vue';
import SidebarGroupLeaf from '../SidebarGroupLeaf.vue';
import { provideSidebarContext } from '../provider';
import { gotchuMenu } from '../gotchuMenu';

// The four queue entries share one route name; this proves the sidebar still
// highlights only the queue the open conversation came through.
const currentRoute = { name: '', path: '', params: {} };

const PATHS = {
  queue_conversations: params => `/app/accounts/1/queue/${params.queue}`,
  all_conversations: () => '/app/accounts/1/all',
  conversation_mentions: () => '/app/accounts/1/mentions/conversations',
  procedures_list: () => '/app/accounts/1/settings/procedures',
};

vi.mock('vue-router', () => ({
  useRoute: () => currentRoute,
  useRouter: () => ({
    resolve: to => ({ path: PATHS[to.name]?.(to.params) ?? '/', meta: {} }),
    getRoutes: () => [],
  }),
}));

vi.mock('dashboard/composables/store', () => ({
  useMapGetter: () => ref(0),
}));

vi.mock('dashboard/composables/usePolicy', () => ({
  usePolicy: () => ({ shouldShow: () => true }),
}));

const queueGroup = () =>
  gotchuMenu({
    t: key => key,
    accountScopedRoute: (name, params = {}) => ({
      name,
      params: { accountId: 1, ...params },
      query: {},
    }),
    reportsGroup: { children: [{ to: { name: 'account_overview_reports' } }] },
    settingsGroup: { name: 'Settings', children: [] },
    helpCenterGroup: { name: 'Portals', children: [] },
    contactsTo: { name: 'contacts_dashboard_index' },
  }).find(item => item.name === 'Queue');

const activeLeaves = route => {
  Object.assign(currentRoute, route);
  const wrapper = mount(
    {
      components: { SidebarGroup },
      setup() {
        provideSidebarContext({
          expandedItem: ref('Queue'),
          setExpandedItem: () => {},
          isCollapsed: ref(false),
          isResizing: ref(false),
        });
        return { group: queueGroup() };
      },
      template: '<SidebarGroup v-bind="group" />',
    },
    { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } }
  );
  return wrapper
    .findAllComponents(SidebarGroupLeaf)
    .filter(leaf => leaf.props('active'))
    .map(leaf => leaf.props('label'));
};

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
});
