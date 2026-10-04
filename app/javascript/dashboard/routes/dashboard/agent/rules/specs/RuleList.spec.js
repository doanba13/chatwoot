import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import RulesAPI from 'dashboard/api/gotchu/rules';
import RuleList from '../RuleList.vue';

vi.mock('dashboard/api/gotchu/rules', () => ({ default: { list: vi.fn() } }));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: name => ({
    value: name === 'getCurrentRole' ? 'administrator' : [],
  }),
  useStore: () => ({ dispatch: vi.fn() }),
}));
vi.mock('dashboard/api/gotchu/stores', () => ({
  default: {
    list: vi.fn().mockResolvedValue({ data: { stores: [], inboxes: [] } }),
  },
}));
withFullI18n();

describe('RuleList', () => {
  it('shows the unconfigured notice instead of an empty table', async () => {
    RulesAPI.list.mockResolvedValue({
      data: { rules: [], facts: [], capabilities: { rules: false } },
    });
    const wrapper = mount(RuleList, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="agent-unconfigured"]').exists()).toBe(
      true
    );
    expect(wrapper.find('table').exists()).toBe(false);
  });

  it('badges a testing rule and labels its count as would apply', async () => {
    RulesAPI.list.mockResolvedValue({
      data: {
        capabilities: { rules: true },
        facts: [],
        rules: [
          {
            id: 1,
            status: 'testing',
            version: 1,
            title: 'T',
            say: 'S',
            sending: 'no_change',
            usedLast7d: 4,
            targetMissing: false,
            conditions: { v: 1, all: [] },
            scope: { storeKey: null, inboxId: null, exceptInboxIds: [] },
          },
        ],
      },
    });
    const wrapper = mount(RuleList, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Testing');
    expect(wrapper.text()).toContain('would apply 4');
  });

  it('shows the failure, and never an empty list, when the read fails', async () => {
    RulesAPI.list.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: { status: 502, data: { reason: 'unavailable' } },
      })
    );
    const wrapper = mount(RuleList, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Gotchu did not confirm that.');
    expect(wrapper.text()).not.toContain('No rules here yet.');
  });
});
