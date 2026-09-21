/**
 * What the composer needs to carry from Insert to Send: the cycle and draft
 * version that were on screen when the supporter pressed Insert, so the
 * eventual send can stamp the outgoing message with them
 * (`content_attributes.gotchu`) and our analytics/corpus can tell an edited
 * draft from an ordinary reply.
 *
 * A plain module-level Map, not a Vuex module or a ref: nothing here is
 * rendered, and the two places that touch it — DraftDockContainer (writes on
 * Insert, clears on a stale poll) and ReplyBox (clears on any other insert,
 * reads and clears on send) — are unrelated components with no store of
 * their own in common. Keyed by conversation id so a supporter with two
 * conversations open cannot stamp one with the other's draft.
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
