import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import RulesAPI from 'dashboard/api/gotchu/rules';
import RuleEditor from '../RuleEditor.vue';

vi.mock('dashboard/api/gotchu/rules', () => ({
  default: { show: vi.fn(), list: vi.fn(), check: vi.fn(), revise: vi.fn() },
}));
const role = vi.hoisted(() => ({ value: 'agent' }));
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
  useMapGetter: name => (name === 'getCurrentRole' ? role : { value: [] }),
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
  afterEach(() => {
    role.value = 'agent';
  });

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

  it('will not save a rule set to one inbox until the inbox is picked', async () => {
    role.value = 'administrator';
    const StoresAPI = (await import('dashboard/api/gotchu/stores')).default;
    StoresAPI.list.mockResolvedValue({
      data: {
        stores: [{ key: 'persoliebe', name: 'persoliebe', inboxes: [] }],
        inboxes: [],
      },
    });
    RulesAPI.show.mockResolvedValue({
      data: { ...rule, scope: { ...rule.scope, storeKey: 'persoliebe' } },
    });
    RulesAPI.list.mockResolvedValue({
      data: { rules: [], facts: [], capabilities: { rules: true } },
    });
    const wrapper = mount(RuleEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    await wrapper.find('[data-testid="rule-scope-inbox"]').trigger('click');
    await wrapper.find('[data-testid="rule-save"]').trigger('click');
    await flushPromises();
    expect(
      wrapper.find('[data-testid="rule-save"]').attributes('disabled')
    ).toBeDefined();
    expect(RulesAPI.revise).not.toHaveBeenCalled();
  });
});
