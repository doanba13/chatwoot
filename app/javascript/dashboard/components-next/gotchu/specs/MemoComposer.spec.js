import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import MemosAPI from 'dashboard/api/gotchu/memos';
import MemoComposer from '../MemoComposer.vue';

vi.mock('dashboard/api/gotchu/memos', () => ({ default: { create: vi.fn() } }));
withFullI18n();

describe('MemoComposer', () => {
  it('sends the conversation and no store, so the scope comes from the conversation', async () => {
    MemosAPI.create.mockResolvedValue({ data: { id: 6 } });
    const wrapper = mount(MemoComposer, {
      props: { conversationId: 4471, storeKey: 'persoliebe', inboxId: 1 },
    });
    await wrapper
      .find('textarea')
      .setValue('Engraved items ship 3 working days later than plain ones.');
    await wrapper.find('[data-testid="memo-add"]').trigger('click');
    await flushPromises();
    expect(MemosAPI.create).toHaveBeenCalledWith({
      text: 'Engraved items ship 3 working days later than plain ones.',
      kind: 'standing_fact',
      conversation_id: 4471,
    });
    expect(wrapper.emitted('saved')).toBeTruthy();
  });

  it('sends all stores only when the supporter widens it', async () => {
    MemosAPI.create.mockResolvedValue({ data: { id: 7 } });
    const wrapper = mount(MemoComposer, {
      props: { conversationId: 4471, storeKey: 'persoliebe', inboxId: 1 },
    });
    await wrapper
      .find('textarea')
      .setValue('Sign off with the first name only.');
    await wrapper.find('[data-testid="memo-scope-all"]').trigger('click');
    await wrapper.find('[data-testid="memo-kind-style"]').trigger('click');
    await wrapper.find('[data-testid="memo-add"]').trigger('click');
    await flushPromises();
    expect(MemosAPI.create).toHaveBeenCalledWith({
      text: 'Sign off with the first name only.',
      kind: 'style',
      conversation_id: 4471,
      scope: { store_key: null, inbox_id: null },
    });
  });

  it('names all stores explicitly when the conversation has no store, because an absent scope is refused', async () => {
    MemosAPI.create.mockResolvedValue({ data: { id: 8 } });
    const wrapper = mount(MemoComposer, {
      props: { conversationId: 4471, storeKey: null, inboxId: 1 },
    });
    await wrapper
      .find('textarea')
      .setValue('Sign off with the first name only.');
    await wrapper.find('[data-testid="memo-add"]').trigger('click');
    await flushPromises();
    expect(MemosAPI.create).toHaveBeenCalledWith({
      text: 'Sign off with the first name only.',
      kind: 'standing_fact',
      conversation_id: 4471,
      scope: { store_key: null, inbox_id: null },
    });
  });

  it('says why when the conversation turned out to have no store', async () => {
    MemosAPI.create.mockRejectedValue(
      Object.assign(new Error('x'), {
        response: {
          status: 422,
          data: { reason: 'scope_required', checks: [] },
        },
      })
    );
    const wrapper = mount(MemoComposer, {
      props: { conversationId: 4471, storeKey: 'persoliebe', inboxId: 1 },
    });
    await wrapper
      .find('textarea')
      .setValue('Sign off with the first name only.');
    await wrapper.find('[data-testid="memo-add"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('This conversation has no store yet.');
  });
});
