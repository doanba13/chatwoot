import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import MemosAPI from 'dashboard/api/gotchu/memos';
import StoresAPI from 'dashboard/api/gotchu/stores';
import MemoEditor from '../MemoEditor.vue';

vi.mock('dashboard/api/gotchu/memos', () => ({
  default: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));
vi.mock('dashboard/api/gotchu/stores', () => ({ default: { list: vi.fn() } }));
vi.mock('vue-router', async o => ({
  ...(await o()),
  useRoute: () => ({ name: 'agent_memo_new', params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}));
withFullI18n();

describe('MemoEditor', () => {
  it('will not save a memo set to one inbox until the inbox is picked', async () => {
    StoresAPI.list.mockResolvedValue({
      data: {
        stores: [{ key: 'giftera', name: 'giftera', inboxes: [] }],
        inboxes: [],
      },
    });
    MemosAPI.list.mockResolvedValue({
      data: { memos: [], proposalsPending: 0, capabilities: { memos: true } },
    });
    const wrapper = mount(MemoEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    await wrapper
      .find('[data-testid="memo-text"] textarea')
      .setValue('Christmas orders close on 15 December.');
    await wrapper.find('[data-testid="memo-scope-inbox"]').trigger('click');
    await wrapper.find('[data-testid="memo-save"]').trigger('click');
    await flushPromises();
    expect(MemosAPI.create).not.toHaveBeenCalled();
  });

  // Board 8 opens a new memo on one store, not on every store: the narrower
  // scope is the one a supporter widens on purpose.
  it('starts a new memo on one store, and saves it there', async () => {
    StoresAPI.list.mockResolvedValue({
      data: {
        stores: [
          { key: 'giftera', name: 'giftera', inboxes: [] },
          { key: 'persoliebe', name: 'persoliebe', inboxes: [] },
        ],
        inboxes: [],
      },
    });
    MemosAPI.list.mockResolvedValue({
      data: { memos: [], proposalsPending: 0, capabilities: { memos: true } },
    });
    MemosAPI.create.mockResolvedValue({ data: { id: 1 } });
    const wrapper = mount(MemoEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(
      wrapper
        .find('[data-testid="memo-scope-store"]')
        .attributes('aria-pressed')
    ).toBe('true');
    await wrapper
      .find('[data-testid="memo-text"] textarea')
      .setValue('Christmas orders close on 15 December.');
    await wrapper.find('[data-testid="memo-save"]').trigger('click');
    await flushPromises();
    expect(MemosAPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { store_key: 'giftera', inbox_id: null },
      })
    );
  });

  it('sits in one card, as board 8 draws it', async () => {
    StoresAPI.list.mockResolvedValue({ data: { stores: [], inboxes: [] } });
    MemosAPI.list.mockResolvedValue({
      data: { memos: [], proposalsPending: 0, capabilities: { memos: true } },
    });
    const wrapper = mount(MemoEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    const card = wrapper.find('[data-testid="memo-card"]');
    expect(card.find('h1').text()).toBe('New memo');
    expect(card.find('[data-testid="memo-save"]').exists()).toBe(true);
  });
});
