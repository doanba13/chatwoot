import { ref, nextTick, defineComponent, h } from 'vue';
import { mount, flushPromises } from '@vue/test-utils';
import ThreadAPI from 'dashboard/api/gotchu/thread';
import { useThreadAnnotations } from '../useThreadAnnotations';
import { useDraftMeta, clearDraftMeta } from '../../helpers/draftMeta';

vi.mock('dashboard/api/gotchu/thread', () => ({ default: { get: vi.fn() } }));

const harness = ({
  id = 7,
  messages = [],
  threadRoutes = true,
  draftKey,
} = {}) => {
  const state = {
    conversationId: ref(id),
    messages: ref(messages),
    threadRoutes: ref(threadRoutes),
    draftKey: ref(draftKey),
  };
  let api;
  mount(
    defineComponent({
      setup() {
        api = useThreadAnnotations(state);
        return () => h('div');
      },
    })
  );
  return { state, api: () => api };
};
const answer = data => ({
  data: { sentDrafts: [], timeline: [], available: true, ...data },
});

describe('useThreadAnnotations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ThreadAPI.get.mockReset();
    [7, 8, 9].forEach(clearDraftMeta);
  });
  afterEach(() => vi.useRealTimers());

  it('maps sent drafts by the message the customer received', async () => {
    ThreadAPI.get.mockResolvedValue(
      answer({
        sentDrafts: [
          {
            messageId: 501,
            version: 1,
            edited: false,
            sentBy: 'agent',
            author: 'model',
            cycleId: 12,
            trace: [],
          },
        ],
      })
    );
    const { api } = harness();
    await flushPromises();
    expect(api().sentDraftFor(501)).toMatchObject({ version: 1 });
    expect(api().sentDraftFor(502)).toBeNull();
  });

  it('matches a string messageId to a numeric message id and back', async () => {
    ThreadAPI.get.mockResolvedValue(
      answer({
        sentDrafts: [
          { messageId: '501', version: 2 },
          { messageId: 600, version: 3 },
        ],
      })
    );
    const { api } = harness();
    await flushPromises();
    expect(api().sentDraftFor(501)).toMatchObject({ version: 2 });
    expect(api().sentDraftFor('600')).toMatchObject({ version: 3 });
  });

  it('renders nothing extra when the gateway has no thread routes', async () => {
    const { api } = harness({ threadRoutes: false });
    await flushPromises();
    expect(ThreadAPI.get).not.toHaveBeenCalled();
    expect(api().timeline.value).toEqual([]);
  });

  it('treats a failed read as no annotations, silently', async () => {
    ThreadAPI.get.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 502 } })
    );
    const { api } = harness();
    await flushPromises();
    expect(api().timeline.value).toEqual([]);
    expect(api().sentDraftFor(1)).toBeNull();
    expect(useDraftMeta(ref(7)).value?.threadAvailable).toBeUndefined();
  });

  it('treats a 404 as no annotations, silently', async () => {
    ThreadAPI.get.mockRejectedValue(
      Object.assign(new Error('x'), { response: { status: 404 } })
    );
    const { api } = harness();
    await flushPromises();
    expect(api().timeline.value).toEqual([]);
  });

  it('records that the feature is absent only when the read says so', async () => {
    ThreadAPI.get.mockResolvedValue(answer({ available: false }));
    harness({ id: 9 });
    await flushPromises();
    expect(useDraftMeta(ref(9)).value.threadAvailable).toBe(false);
  });

  it('records that the feature is present when the read says so', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    harness({ id: 9 });
    await flushPromises();
    expect(useDraftMeta(ref(9)).value.threadAvailable).toBe(true);
  });

  it('drops an answer for a conversation that is no longer open', async () => {
    let resolveFirst;
    ThreadAPI.get
      .mockImplementationOnce(
        () =>
          new Promise(r => {
            resolveFirst = r;
          })
      )
      .mockResolvedValueOnce(
        answer({ timeline: [{ at: '2026-10-06T10:00:00Z', kind: 'drafted' }] })
      );
    const { state, api } = harness({ id: 7 });
    state.conversationId.value = 8;
    await nextTick();
    await flushPromises();
    resolveFirst(
      answer({
        timeline: [
          { at: '2026-10-06T09:00:00Z', kind: 'auto_sent', version: 1 },
        ],
      })
    );
    await flushPromises();
    expect(api().timeline.value.map(i => i.kind)).toEqual(['drafted']);
    expect(useDraftMeta(ref(7)).value).toBeNull();
  });

  it('re-reads shortly after an outgoing message lands', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness({ messages: [{ id: 1, messageType: 0 }] });
    await flushPromises();
    state.messages.value = [...state.messages.value, { id: 2, messageType: 1 }];
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(2);
  });

  it('reads snake_case message_type too', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness({ messages: [{ id: 1, message_type: 0 }] });
    await flushPromises();
    state.messages.value = [
      ...state.messages.value,
      { id: 2, message_type: 2 },
    ];
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(2);
  });

  it('does not re-read when only incoming messages arrive', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness({ messages: [{ id: 1, messageType: 0 }] });
    await flushPromises();
    state.messages.value = [...state.messages.value, { id: 2, messageType: 0 }];
    await nextTick();
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(1);
  });

  it('keeps the newer answer when two reads of one conversation finish out of order', async () => {
    const resolvers = [];
    ThreadAPI.get.mockImplementation(
      () =>
        new Promise(r => {
          resolvers.push(r);
        })
    );
    const { state, api } = harness({ messages: [{ id: 1, messageType: 0 }] });
    await flushPromises();
    state.messages.value = [...state.messages.value, { id: 2, messageType: 1 }];
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(resolvers).toHaveLength(2);
    resolvers[1](
      answer({ timeline: [{ at: '2026-10-06T10:00:00Z', kind: 'drafted' }] })
    );
    await flushPromises();
    resolvers[0](answer({ available: false }));
    await flushPromises();
    expect(api().timeline.value.map(i => i.kind)).toEqual(['drafted']);
    expect(useDraftMeta(ref(7)).value.threadAvailable).toBe(true);
  });

  it('does not fetch without a conversation id', async () => {
    harness({ id: null });
    await flushPromises();
    expect(ThreadAPI.get).not.toHaveBeenCalled();
  });

  it('cancels a pending re-read when the conversation changes', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness({ messages: [{ id: 1, messageType: 0 }] });
    await flushPromises();
    state.messages.value = [...state.messages.value, { id: 2, messageType: 1 }];
    await nextTick();
    state.conversationId.value = 8;
    await nextTick();
    await flushPromises();
    ThreadAPI.get.mockClear();
    vi.advanceTimersByTime(3000);
    await flushPromises();
    expect(ThreadAPI.get).not.toHaveBeenCalled();
  });

  it('re-reads after the draft changes, so the drafted line appears', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness({ draftKey: 'none' });
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(1);

    state.draftKey.value = '12:1';
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(2);

    state.draftKey.value = '12:2';
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(3);
  });

  it('does not re-read for the first draft read, or for a conversation switch', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state } = harness();
    await flushPromises();
    state.draftKey.value = '12:1'; // the dock's first read of this conversation
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(1);

    state.conversationId.value = 8;
    state.draftKey.value = '30:4';
    await nextTick();
    vi.advanceTimersByTime(1500);
    await flushPromises();
    expect(ThreadAPI.get).toHaveBeenCalledTimes(2);
  });

  it('says once per conversation when its first annotations have landed', async () => {
    ThreadAPI.get.mockResolvedValue(answer({}));
    const { state, api } = harness();
    expect(api().annotatedFor.value).toBeNull();
    await flushPromises();
    expect(api().annotatedFor.value).toBe(7);

    ThreadAPI.get.mockReturnValue(new Promise(() => {})); // 8's read hangs
    state.conversationId.value = 8;
    await flushPromises();
    expect(api().annotatedFor.value).toBeNull();
  });
});
