/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Rails proxy in front of the gateway's memos (`Gotchu::MemosController`),
 * open to every agent:
 *
 *   GET    /api/v1/accounts/:account_id/gotchu/memos[?store=&inbox=&include=expired]
 *   POST   /api/v1/accounts/:account_id/gotchu/memos
 *   PUT    /api/v1/accounts/:account_id/gotchu/memos/:id   (supersedes)
 *   DELETE /api/v1/accounts/:account_id/gotchu/memos/:id   (a soft revoke)
 *
 * A composer memo carries `conversation_id`; Rails authorises it for the
 * signed-in agent before forwarding. The actor never travels from here.
 */
class MemosAPI extends ApiClient {
  constructor() {
    super('gotchu/memos', { accountScoped: true });
  }

  list(params = {}) {
    return axios.get(this.url, { params });
  }

  create(body) {
    return axios.post(this.url, body);
  }

  update(id, body) {
    return axios.put(`${this.url}/${id}`, body);
  }

  remove(id) {
    return axios.delete(`${this.url}/${id}`);
  }
}

export default new MemosAPI();
