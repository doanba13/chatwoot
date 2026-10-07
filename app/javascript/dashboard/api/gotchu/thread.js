/* global axios */

import ApiClient from '../ApiClient';

/**
 * GET /api/v1/accounts/:account_id/conversations/:conversation_id/gotchu_thread
 * -> { sentDrafts, timeline, available }. Display id, like aiDraft.js.
 */
class ThreadAPI extends ApiClient {
  constructor() {
    super('conversations', { accountScoped: true });
  }

  get(conversationId) {
    return axios.get(`${this.url}/${conversationId}/gotchu_thread`);
  }
}

export default new ThreadAPI();
