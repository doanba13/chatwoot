import MessageApi from '../../../../api/inbox/message';
import types from '../../../mutation-types';
import actions, {
  withTranslation,
} from '../../conversations/actions/messageTranslateActions';

vi.mock('../../../../api/inbox/message', () => ({
  default: { translateMessage: vi.fn() },
}));

const payload = { conversationId: 5, messageId: 9, targetLanguage: 'vi' };
const makeState = () => ({
  allConversations: [
    {
      id: 5,
      messages: [
        {
          id: 9,
          conversation_id: 5,
          content: 'Hallo',
          content_attributes: {
            translations: { de: 'Hallo' },
            translation_partial: ['de'],
          },
        },
      ],
    },
  ],
});

describe('translateMessage', () => {
  it('commits the translation from the response, merged and immutably', async () => {
    const state = makeState();
    const original = state.allConversations[0].messages[0];
    MessageApi.translateMessage.mockResolvedValue({
      data: { content: 'xin chào', skipped: false, partial: true },
    });
    const commit = vi.fn();
    await actions.translateMessage({ commit, state }, payload);
    expect(commit).toHaveBeenCalledTimes(1);
    const [type, message] = commit.mock.calls[0];
    expect(type).toBe(types.ADD_MESSAGE);
    expect(message.content_attributes.translations).toEqual({
      de: 'Hallo',
      vi: 'xin chào',
    });
    expect(message.content_attributes.translation_partial).toEqual([
      'de',
      'vi',
    ]);
    expect(original.content_attributes.translations).toEqual({ de: 'Hallo' });
    expect(original.content_attributes.translation_partial).toEqual(['de']);
  });

  it('commits nothing when the response is skipped', async () => {
    MessageApi.translateMessage.mockResolvedValue({
      data: { content: 'Hallo', skipped: true, partial: false },
    });
    const commit = vi.fn();
    await actions.translateMessage({ commit, state: makeState() }, payload);
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits nothing when the message is no longer in the store', async () => {
    MessageApi.translateMessage.mockResolvedValue({
      data: { content: 'x', skipped: false, partial: false },
    });
    const commit = vi.fn();
    await actions.translateMessage(
      { commit, state: { allConversations: [] } },
      payload
    );
    expect(commit).not.toHaveBeenCalled();
  });

  it('propagates a failed request', async () => {
    MessageApi.translateMessage.mockRejectedValue(new Error('429'));
    await expect(
      actions.translateMessage({ commit: vi.fn(), state: makeState() }, payload)
    ).rejects.toThrow('429');
  });
});

describe('withTranslation', () => {
  it('drops the partial mark when the new translation is complete', () => {
    const next = withTranslation(
      { id: 1, content_attributes: { translation_partial: ['vi'] } },
      'vi',
      'ok',
      false
    );
    expect(next.content_attributes.translation_partial).toEqual([]);
  });
});
