import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import AgentAPI from 'dashboard/api/gotchu/agent';
import AgentOverview from '../AgentOverview.vue';

vi.mock('dashboard/api/gotchu/agent', () => ({
  default: { overview: vi.fn(), stopAuto: vi.fn() },
}));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: name => ({
    value: name === 'getCurrentRole' ? 'administrator' : [],
  }),
  useStore: () => ({ dispatch: vi.fn() }),
}));
vi.mock('dashboard/api/gotchu/stores', () => ({
  default: {
    list: vi.fn().mockResolvedValue({
      data: { stores: [{ key: 'a', inboxes: [] }], inboxes: [] },
    }),
  },
}));
vi.mock('dashboard/api/gotchu/memoProposals', () => ({
  default: {
    list: vi.fn().mockResolvedValue({ data: { proposals: [] } }),
    decide: vi.fn(),
  },
}));
withFullI18n();

const holding = {
  cycleId: 31,
  conversationId: 4471,
  procedureTitle: 'Where is my order',
  channel: 'email',
  firesAt: new Date(Date.now() + 38000).toISOString(),
};

describe('AgentOverview', () => {
  it('shows the unconfigured notice', async () => {
    AgentAPI.overview.mockResolvedValue({
      data: { capabilities: { overview: false } },
    });
    const wrapper = mount(AgentOverview, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="agent-unconfigured"]').exists()).toBe(
      true
    );
  });

  it('stops a holding send and keeps it as a draft', async () => {
    AgentAPI.overview.mockResolvedValue({
      data: {
        capabilities: { overview: true },
        procedures: [],
        holding: [holding],
        noMatch: { count: 0, conversationIds: [] },
        proposalsPending: 0,
        rulesActive: 0,
      },
    });
    AgentAPI.stopAuto.mockResolvedValue({ data: { ok: true } });
    const wrapper = mount(AgentOverview, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    await wrapper.find('[data-testid="holding-stop-31"]').trigger('click');
    await flushPromises();
    expect(AgentAPI.stopAuto).toHaveBeenCalledWith(31);
    expect(wrapper.text()).toContain('Stopped. It stays a draft.');
  });

  it('says it is no longer waiting, never stopped, on a 409', async () => {
    AgentAPI.overview.mockResolvedValue({
      data: {
        capabilities: { overview: true },
        procedures: [],
        holding: [holding],
        noMatch: { count: 0, conversationIds: [] },
        proposalsPending: 0,
        rulesActive: 0,
      },
    });
    AgentAPI.stopAuto.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: { status: 409, data: { reason: 'not_holding' } },
      })
    );
    const wrapper = mount(AgentOverview, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    await wrapper.find('[data-testid="holding-stop-31"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(
      'No longer waiting to send. It was sent, or someone already stopped it.'
    );
    expect(wrapper.text()).not.toContain('Stopped.');
  });
});
