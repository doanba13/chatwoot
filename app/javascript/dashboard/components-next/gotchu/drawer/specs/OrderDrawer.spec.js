import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ContextAPI from 'dashboard/api/gotchu/context';
import OrderDrawer from '../OrderDrawer.vue';
import { persoliebe, cadeauniq } from './fixtures';

vi.mock('dashboard/api/gotchu/context', () => ({ default: { get: vi.fn() } }));
vi.mock('dashboard/composables/useAccount', () => ({
  useAccount: () => ({ accountId: { value: 1 } }),
}));

withFullI18n();

const mountDrawer = (props = {}) =>
  mount(OrderDrawer, {
    props: {
      conversationId: 7,
      contact: { id: 3, name: 'Sabine K.' },
      lang: 'de',
      ...props,
    },
  });

describe('OrderDrawer', () => {
  beforeEach(() => ContextAPI.get.mockReset());

  it.each([
    [
      503,
      'Order details are not available: the order lookup is not set up on this desk.',
    ],
    [502, 'Order details are not available: the order lookup did not answer.'],
  ])(
    'says why there is no order on a %i, never a blank drawer',
    async (status, text) => {
      ContextAPI.get.mockRejectedValueOnce(
        Object.assign(new Error('x'), { response: { status } })
      );
      const wrapper = mountDrawer();
      await flushPromises();
      expect(wrapper.find('[data-testid="drawer-not-available"]').text()).toBe(
        text
      );
    }
  );

  it('offers Refresh when a retry can succeed, and not when it cannot', async () => {
    ContextAPI.get.mockRejectedValueOnce(
      Object.assign(new Error('x'), { response: { status: 502 } })
    );
    const retry = mountDrawer();
    await flushPromises();
    expect(retry.find('[data-testid="drawer-refresh"]').exists()).toBe(true);

    ContextAPI.get.mockRejectedValueOnce(
      Object.assign(new Error('x'), { response: { status: 503 } })
    );
    const setup = mountDrawer();
    await flushPromises();
    expect(setup.find('[data-testid="drawer-refresh"]').exists()).toBe(false);
  });

  it('disables Refresh while a refresh is in flight', async () => {
    ContextAPI.get.mockResolvedValueOnce({ data: persoliebe });
    const wrapper = mountDrawer();
    await flushPromises();
    ContextAPI.get.mockImplementationOnce(() => new Promise(() => {}));
    await wrapper.find('[data-testid="drawer-refresh"]').trigger('click');
    expect(
      wrapper.find('[data-testid="drawer-refresh"]').attributes('disabled')
    ).toBeDefined();
  });

  it('names the order and says why a restricted store shows no email', async () => {
    ContextAPI.get.mockResolvedValueOnce({ data: cadeauniq });
    const wrapper = mountDrawer();
    await flushPromises();
    expect(wrapper.find('h2').text()).toContain('CU-');
    expect(wrapper.text()).toContain('hides customer details');
  });

  it('shows candidates and never one order when several match', async () => {
    ContextAPI.get.mockResolvedValueOnce({
      data: {
        ...persoliebe,
        ambiguous: true,
        candidates: [
          { orderName: 'PL-1', storeKey: 'persoliebe' },
          { orderName: 'CU-2', storeKey: 'cadeauniq' },
        ],
      },
    });
    const wrapper = mountDrawer();
    await flushPromises();
    const box = wrapper.find('[data-testid="drawer-ambiguous"]');
    expect(box.text()).toContain('Several orders match, so none was picked');
    expect(box.text()).toContain('PL-1');
    expect(wrapper.text()).not.toContain('PL-5713');
    expect(wrapper.find('[data-testid="drawer-customer"]').exists()).toBe(
      false
    );
  });
});
