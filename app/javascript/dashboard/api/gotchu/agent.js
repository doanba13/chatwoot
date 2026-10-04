/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Agent overview and the Stop for a holding auto send
 * (`Gotchu::AgentController`), open to every agent:
 *
 *   GET  /api/v1/accounts/:account_id/gotchu/agent/overview?days=7
 *   POST /api/v1/accounts/:account_id/gotchu/cycles/:id/stop_auto
 *
 * A 409 on the Stop is `not_holding`: the release or another person's Stop
 * won, and the page must not say "stopped".
 */
class AgentAPI extends ApiClient {
  constructor() {
    super('gotchu', { accountScoped: true });
  }

  overview(days = 7) {
    return axios.get(`${this.url}/agent/overview`, { params: { days } });
  }

  stopAuto(cycleId) {
    return axios.post(`${this.url}/cycles/${cycleId}/stop_auto`);
  }
}

export default new AgentAPI();
