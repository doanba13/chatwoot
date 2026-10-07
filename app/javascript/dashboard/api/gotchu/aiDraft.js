/* global axios */

import ApiClient from '../ApiClient';

/**
 * The read proxy in front of the reply worker's own database.
 *
 *   GET /api/v1/accounts/:account_id/conversations/:conversation_id/ai_draft
 *
 * `conversations` is the resource, the way it is for labels: the endpoint is
 * nested under a conversation, so ApiClient builds the account-scoped prefix and
 * the nested path is spelled out here.
 *
 * The id is the DISPLAY id — what `currentChat.id` carries, what dashboard URLs
 * carry, and what every other conversation route here already resolves. The
 * gateway keys its reply cycles by the same value, because that is the field
 * Chatwoot's own outgoing webhook payload calls `conversation_id`. Sending
 * Conversation#id would ask for another conversation's draft.
 */
class AiDraftAPI extends ApiClient {
  constructor() {
    super('conversations', { accountScoped: true });
  }

  // Not `get`/`show`: the base class already owns both names with different
  // signatures, and a read whose argument means something else under a familiar
  // name is the kind of thing that survives review.
  //
  // `requestId` is the token of an instruction this browser submitted and is
  // waiting on: with it, the read also reports how that instruction turned out
  // (`instruction` in the body). Without it, `instruction` comes back null.
  getDraft(conversationId, { requestId } = {}) {
    return axios.get(`${this.url}/${conversationId}/ai_draft`, {
      params: requestId ? { request_id: requestId } : {},
    });
  }

  /**
   * Tell the agent what to change about its draft.
   *
   *   POST /api/v1/accounts/:account_id/conversations/:conversation_id/ai_draft_instruction
   *
   * The only write on this surface. It can produce a note and a new draft
   * version and it cannot reach a customer, which is why it is the one gesture
   * wired up: sending a draft has its own conditions and is not here.
   *
   * Snake case on the wire, like every other Rails route in this dashboard. The
   * gateway's own camelCase payload is assembled server-side, where the
   * credentials it needs live.
   *
   * `requestId` is an idempotency token, not an id of anything: the same value
   * twice is one instruction, two values are two. The caller owns that decision
   * — see DraftDockContainer.
   *
   * No actor travels. The acting agent is the session's own user, established in
   * Rails from `Current.user`; a body field claiming one would be a claim about
   * who pressed the key rather than an identity, and it is ignored.
   */
  instruct(conversationId, { text, cycleId, requestId }) {
    return axios.post(`${this.url}/${conversationId}/ai_draft_instruction`, {
      text,
      cycle_id: cycleId,
      request_id: requestId,
    });
  }

  /**
   * Stop an instruction while it is being redrafted (spec §3.4). Never changes
   * cycle state; the worker's compare-and-set is what keeps a late v2 out.
   */
  cancelInstruction(conversationId, requestId) {
    return axios.post(
      `${this.url}/${conversationId}/ai_draft_instruction/cancel`,
      { request_id: requestId }
    );
  }
}

export default new AiDraftAPI();
