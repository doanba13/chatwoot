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

  it('says a procedure is set to send on its own, never that it sends', async () => {
    // A stored Auto may never fire (only email can, and only for a store that
    // is switched on), so the headline names the setting, not a send.
    AgentAPI.overview.mockResolvedValue({
      data: {
        capabilities: { overview: true },
        procedures: [
          {
            id: 1,
            title: 'Where is my order',
            status: 'active',
            version: 2,
            tiers: { email: 'draft', messenger: 'auto', web: 'off' },
            used: 3,
            sentUnedited: null,
            handedOver: null,
          },
        ],
        holding: [],
        noMatch: { count: 0, conversationIds: [] },
        proposalsPending: 0,
        rulesActive: 0,
      },
    });
    const wrapper = mount(AgentOverview, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('is set to send on its own');
    expect(wrapper.text()).not.toMatch(/procedures? sends? on (its|their) own/);
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
    // The Stop names its conversation; the fork authorises it (fix wave FS1).
    expect(AgentAPI.stopAuto).toHaveBeenCalledWith(31, 4471);
    expect(wrapper.text()).toContain('Stopped. It stays a draft.');
    expect(wrapper.text()).not.toContain('Sending on its own in');
  });

  const overviewOf = holds => ({
    data: {
      capabilities: { overview: true },
      procedures: [],
      holding: holds,
      noMatch: { count: 0, conversationIds: [] },
      proposalsPending: 0,
      rulesActive: 0,
    },
  });

  // After a real 409 the cycle is no longer holding, so the re-read the page
  // makes no longer lists it: the answer must survive that.
  const pressStopAnswered409 = async data => {
    AgentAPI.overview
      .mockResolvedValueOnce(overviewOf([holding]))
      .mockResolvedValue(overviewOf([]));
    AgentAPI.stopAuto.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 409, data } })
    );
    const wrapper = mount(AgentOverview, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    await wrapper.find('[data-testid="holding-stop-31"]').trigger('click');
    await flushPromises();
    return wrapper;
  };

  // Spec §14 row 2: it says it is already sending, and the card's header no
  // longer counts down to a send that has happened. No cause, or one this
  // build does not know, says the same: the other answer invites a reply by
  // hand on top of one that may be going out.
  it.each([
    ['cause sending', { reason: 'not_holding', cause: 'sending' }],
    ['no cause', { reason: 'not_holding' }],
    ['an unknown cause', { reason: 'not_holding', cause: 'elsewhere' }],
  ])(
    'says it is already sending, never stopped, on a 409 with %s',
    async (_name, data) => {
      const wrapper = await pressStopAnswered409(data);
      expect(wrapper.text()).toContain('Sending now');
      expect(wrapper.text()).toContain('Already sending — too late to stop.');
      expect(wrapper.text()).not.toContain('Stopped');
      expect(wrapper.text()).not.toContain('Sending on its own in');
    }
  );

  // Staging: a second supporter pressed Stop on a card someone had already
  // stopped, and was told it was sending while the draft stayed a draft.
  it('says someone already stopped it, never sending, on a 409 with cause stopped', async () => {
    const wrapper = await pressStopAnswered409({
      reason: 'not_holding',
      cause: 'stopped',
    });
    expect(wrapper.text()).toContain('Kept as a draft');
    expect(wrapper.text()).toContain(
      'Someone already stopped this send. It stays a draft.'
    );
    expect(wrapper.text()).not.toMatch(/sending/i);
    expect(wrapper.find('[data-testid="holding-stop-31"]').exists()).toBe(
      false
    );
  });

  it.each([
    [3395, 'Sending on its own in 56 min'],
    [60, 'Sending on its own in 1 min'],
    [45, 'Sending on its own in 45 s'],
  ])(
    'counts down %s seconds in words a person reads',
    async (seconds, title) => {
      vi.useFakeTimers({ now: new Date('2026-10-05T10:00:00Z') });
      try {
        AgentAPI.overview.mockResolvedValue(
          overviewOf([
            {
              ...holding,
              firesAt: new Date(
                Date.parse('2026-10-05T10:00:00Z') + seconds * 1000
              ).toISOString(),
            },
          ])
        );
        const wrapper = mount(AgentOverview, {
          global: { stubs: { 'router-link': true } },
        });
        await flushPromises();
        expect(wrapper.text()).toContain(title);
        expect(wrapper.text()).not.toMatch(/\d{3,} s\b/);
        wrapper.unmount();
      } finally {
        vi.useRealTimers();
      }
    }
  );
});
