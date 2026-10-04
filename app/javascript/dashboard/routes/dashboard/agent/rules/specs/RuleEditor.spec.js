import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import RulesAPI from 'dashboard/api/gotchu/rules';
import RuleEditor from '../RuleEditor.vue';

vi.mock('dashboard/api/gotchu/rules', () => ({
  default: { show: vi.fn(), list: vi.fn(), check: vi.fn() },
}));
vi.mock('dashboard/api/gotchu/stores', () => ({
  default: {
    list: vi.fn().mockResolvedValue({ data: { stores: [], inboxes: [] } }),
  },
}));
vi.mock('vue-router', async o => ({
  ...(await o()),
  useRoute: () => ({ params: { ruleId: '1' }, name: 'agent_rule' }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: name => ({ value: name === 'getCurrentRole' ? 'agent' : [] }),
  useStore: () => ({ dispatch: vi.fn() }),
}));
withFullI18n();

const rule = {
  id: 1,
  status: 'active',
  version: 2,
  title: 'T',
  say: 'S',
  sending: 'never_auto',
  usedLast7d: 0,
  targetMissing: false,
  conditions: { v: 1, all: [] },
  scope: { storeKey: null, inboxId: null, exceptInboxIds: [] },
};

describe('RuleEditor', () => {
  it('renders read-only for an agent: no save, no activate, inputs disabled', async () => {
    RulesAPI.show.mockResolvedValue({ data: rule });
    RulesAPI.list.mockResolvedValue({
      data: { rules: [], facts: [], capabilities: { rules: true } },
    });
    const wrapper = mount(RuleEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="rule-save"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="rule-activate"]').exists()).toBe(false);
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    expect(RulesAPI.check).not.toHaveBeenCalled();
  });
});
