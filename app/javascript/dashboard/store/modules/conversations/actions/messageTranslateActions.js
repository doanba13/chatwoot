import MessageApi from '../../../../api/inbox/message';
import types from '../../../mutation-types';

// The new message with `target` translated, built from fresh objects.
export const withTranslation = (message, target, content, partial) => {
  const attributes = message.content_attributes || {};
  const partials = (attributes.translation_partial || []).filter(
    lang => lang !== target
  );
  return {
    ...message,
    content_attributes: {
      ...attributes,
      translations: { ...(attributes.translations || {}), [target]: content },
      translation_partial: partial ? [...partials, target] : partials,
    },
  };
};

export default {
  async translateMessage(
    { commit, state },
    { conversationId, messageId, targetLanguage }
  ) {
    const { data } = await MessageApi.translateMessage(
      conversationId,
      messageId,
      targetLanguage
    );
    if (!data || data.skipped !== false || !data.content) return;

    // The realtime broadcast carries the same text, but a missed one would
    // leave the bubble untranslated, so the response is applied here too.
    const chat = state.allConversations.find(c => c.id === conversationId);
    const message = chat?.messages.find(m => m.id === messageId);
    if (!message) return;
    commit(
      types.ADD_MESSAGE,
      withTranslation(message, targetLanguage, data.content, data.partial)
    );
  },
};
