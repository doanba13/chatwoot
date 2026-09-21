/**
 * What the composer needs to carry from Insert to Send: the cycle and draft
 * version that were on screen when the supporter pressed Insert, so the
 * eventual send can stamp the outgoing message with them
 * (`content_attributes.gotchu`) and our analytics/corpus can tell an edited
 * draft from an ordinary reply.
 *
 * A plain module-level Map, not a Vuex module or a ref: nothing here is
 * rendered, and the places that touch it — DraftDockContainer (writes on
 * Insert, clears on a stale poll), Editor.vue (clears on a rich-editor
 * insert or a canned response) and ReplyBox (clears on a plain-editor
 * insert, stamps and clears on send) — are unrelated components with no
 * store of their own in common. Keyed by conversation id so a supporter with
 * two conversations open cannot stamp one with the other's draft.
 *
 * Pure on purpose: nothing here touches the event bus or a component
 * instance, which is what makes it testable without mounting anything.
 */
const remembered = new Map();

export const rememberInsertedDraft = (conversationId, draft) => {
  remembered.set(conversationId, draft);
};

export const forgetInsertedDraft = conversationId => {
  remembered.delete(conversationId);
};

export const insertedDraftFor = conversationId =>
  remembered.get(conversationId) ?? null;

/**
 * Stamps `content_attributes.gotchu` onto a send payload when a draft is
 * remembered for the conversation, and returns the payload unchanged
 * otherwise — the thing that keeps an unstamped send an ordinary one.
 *
 * Merges rather than replaces `contentAttributes`, so a reply-to
 * (`in_reply_to`, set by ReplyBox's `setReplyToInPayload`) survives
 * alongside the stamp instead of being clobbered by it.
 */
export const stampSendPayload = (conversationId, messagePayload) => {
  const draft = insertedDraftFor(conversationId);
  if (!draft) return messagePayload;

  return {
    ...messagePayload,
    contentAttributes: {
      ...messagePayload.contentAttributes,
      gotchu: draft,
    },
  };
};
