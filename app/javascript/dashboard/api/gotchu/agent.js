/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Agent overview and the Stop for a holding auto send
 * (`Gotchu::AgentController`), open to every agent:
 *
 *   GET  /api/v1/accounts/:account_id/gotchu/agent/overview?days=7
 *   POST /api/v1/accounts/:account_id/gotchu/cycles/:id/stop_auto
 *        { conversation_id }
 *
 * A Stop names its conversation (the display id): the controller refuses a
 * user who cannot open it. A 409 on the Stop is `not_holding`: the release or
 * another person's Stop won, and the page must not say "stopped". Its `cause`
 * is `sending` or `stopped` when the gateway could tell which, and absent
 * otherwise.
 */
class AgentAPI extends ApiClient {
  constructor() {
    super('gotchu', { accountScoped: true });
  }

  overview(days = 7) {
    return axios.get(`${this.url}/agent/overview`, { params: { days } });
  }

  stopAuto(cycleId, conversationId) {
    return axios.post(`${this.url}/cycles/${cycleId}/stop_auto`, {
      conversation_id: conversationId,
    });
  }
}

export default new AgentAPI();
