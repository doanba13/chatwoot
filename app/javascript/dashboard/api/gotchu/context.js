/* global axios */

import ApiClient from '../ApiClient';

/**
 * GET /api/v1/accounts/:account_id/conversations/:conversation_id/gotchu_context
 * The order context for the drawer; `refresh` bypasses the gateway's cache.
 */
class ContextAPI extends ApiClient {
  constructor() {
    super('conversations', { accountScoped: true });
  }

  get(conversationId, { refresh } = {}) {
    return axios.get(`${this.url}/${conversationId}/gotchu_context`, {
      params: refresh ? { refresh: 1 } : {},
    });
  }
}

export default new ContextAPI();
