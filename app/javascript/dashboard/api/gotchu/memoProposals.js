/* global axios */

import ApiClient from '../ApiClient';

/**
 * The nightly memo proposals (`Gotchu::MemoProposalsController`), open to
 * every agent:
 *
 *   GET  /api/v1/accounts/:account_id/gotchu/memo_proposals
 *   POST /api/v1/accounts/:account_id/gotchu/memo_proposals/:id/decision
 */
class MemoProposalsAPI extends ApiClient {
  constructor() {
    super('gotchu/memo_proposals', { accountScoped: true });
  }

  list() {
    return axios.get(this.url);
  }

  /** `decision` is 'confirm' | 'dismiss'. */
  decide(id, decision) {
    return axios.post(`${this.url}/${id}/decision`, { decision });
  }
}

export default new MemoProposalsAPI();
