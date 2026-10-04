/* global axios */

import ApiClient from '../ApiClient';

/**
 * The store list every agent can read (`Gotchu::StoresController`):
 *
 *   GET /api/v1/accounts/:account_id/gotchu/stores
 *
 * Answers `{ stores: [{ key, name, inboxes: [{ id, channel }] }],
 * inboxes: [{ id, name, channel }], capabilities: { stores } }`. Never shop
 * addresses; for an agent who is not an administrator, only their own
 * inboxes.
 */
class StoresAPI extends ApiClient {
  constructor() {
    super('gotchu/stores', { accountScoped: true });
  }

  list() {
    return axios.get(this.url);
  }
}

export default new StoresAPI();
