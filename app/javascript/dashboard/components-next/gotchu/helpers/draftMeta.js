import { computed, reactive, unref } from 'vue';

/**
 * What the draft read learned about a conversation that the header, drawer and
 * thread need too, keyed by display id. Two writers (DraftDockContainer and the
 * thread annotations), so a write merges and never replaces.
 * `threadAvailable` stays undefined until a thread read answers.
 */
const metaByConversation = reactive(new Map());

export const setDraftMeta = (conversationId, patch) => {
  metaByConversation.set(conversationId, {
    ...metaByConversation.get(conversationId),
    ...patch,
  });
};

export const clearDraftMeta = conversationId => {
  metaByConversation.delete(conversationId);
};

export const useDraftMeta = conversationIdRef =>
  computed(() => metaByConversation.get(unref(conversationIdRef)) ?? null);
