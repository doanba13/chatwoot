import { ref, nextTick, defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import ContextAPI from 'dashboard/api/gotchu/context';
import { useOrderContext } from '../useOrderContext';

vi.mock('dashboard/api/gotchu/context', () => ({ default: { get: vi.fn() } }));
const harness = id => {
  const conversationId = ref(id);
  let api;
  mount(
    defineComponent({
      setup() {
        api = useOrderContext(conversationId);
        return () => h('div');
      },
    })
  );
  return { conversationId, api: () => api };
};

describe('useOrderContext', () => {
  beforeEach(() => ContextAPI.get.mockReset());

  it('locks Refresh while one is in flight and asks for an uncached read', async () => {
    ContextAPI.get.mockResolvedValueOnce({ data: { conversationId: 7 } });
    const { api } = harness(7);
    await flushPromises();
    let finish;
    ContextAPI.get.mockImplementationOnce(
      () =>
        new Promise(r => {
          finish = r;
        })
    );
    api().refresh();
    api().refresh();
    expect(api().refreshing.value).toBe(true);
    expect(ContextAPI.get).toHaveBeenCalledTimes(2);
    expect(ContextAPI.get).toHaveBeenLastCalledWith(7, { refresh: true });
    finish({ data: { conversationId: 7 } });
    await flushPromises();
    expect(api().refreshing.value).toBe(false);
  });

  it('drops a context answer for a conversation that is no longer open', async () => {
    let first;
    ContextAPI.get
      .mockImplementationOnce(
        () =>
          new Promise(r => {
            first = r;
          })
      )
      .mockResolvedValueOnce({ data: { conversationId: 8 } });
    const { conversationId, api } = harness(7);
    conversationId.value = 8;
    await nextTick();
    await flushPromises();
    first({ data: { conversationId: 7 } });
    await flushPromises();
    expect(api().context.value.conversationId).toBe(8);
  });

  it('keeps the last context when a Refresh fails', async () => {
    ContextAPI.get
      .mockResolvedValueOnce({ data: { conversationId: 7 } })
      .mockRejectedValueOnce(
        Object.assign(new Error('x'), { response: { status: 502 } })
      );
    const { api } = harness(7);
    await flushPromises();
    await api().refresh();
    await flushPromises();
    expect(api().context.value.conversationId).toBe(7);
    expect(api().state.value).toBe('ready');
    expect(api().refreshing.value).toBe(false);
  });

  it('says unconfigured on a 503, so the drawer can say why it has no order', async () => {
    ContextAPI.get.mockRejectedValueOnce(
      Object.assign(new Error('x'), { response: { status: 503 } })
    );
    const { api } = harness(7);
    await flushPromises();
    expect(api().state.value).toBe('unconfigured');
  });

  it('says unavailable on any other failure', async () => {
    ContextAPI.get.mockRejectedValueOnce(new Error('network'));
    const { api } = harness(7);
    await flushPromises();
    expect(api().state.value).toBe('unavailable');
  });
});
