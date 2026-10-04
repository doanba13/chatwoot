/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Rails proxy in front of the gateway's rules (`Gotchu::RulesController`):
 *
 *   GET  /api/v1/accounts/:account_id/gotchu/rules[?store=&inbox=&status=]
 *   GET  /api/v1/accounts/:account_id/gotchu/rules/:id
 *   POST /api/v1/accounts/:account_id/gotchu/rules
 *   PUT  /api/v1/accounts/:account_id/gotchu/rules/:id      (a new revision)
 *   POST /api/v1/accounts/:account_id/gotchu/rules/:id/status
 *   POST /api/v1/accounts/:account_id/gotchu/rules/check
 *   POST /api/v1/accounts/:account_id/gotchu/rules/replay
 *
 * Reads are open to every agent; the rest are administrators only. `create`
 * answers a RuleView; `revise` and `setStatus` `{ rule, demoted }`; `check`
 * `{ checks, overlaps }`. The actor never travels from here.
 */
class RulesAPI extends ApiClient {
  constructor() {
    super('gotchu/rules', { accountScoped: true });
  }

  list(params = {}) {
    return axios.get(this.url, { params });
  }

  show(id) {
    return axios.get(`${this.url}/${id}`);
  }

  create(body) {
    return axios.post(this.url, body);
  }

  revise(id, body, expectedVersion) {
    return axios.put(`${this.url}/${id}`, {
      ...body,
      expected_version: expectedVersion,
    });
  }

  setStatus(id, status, expectedVersion) {
    return axios.post(`${this.url}/${id}/status`, {
      status,
      expected_version: expectedVersion,
    });
  }

  check(body) {
    return axios.post(`${this.url}/check`, body);
  }

  replay(body, { days = 30, ruleId } = {}) {
    return axios.post(`${this.url}/replay`, {
      ...body,
      days,
      rule_id: ruleId,
    });
  }
}

export default new RulesAPI();
