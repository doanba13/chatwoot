/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Rails proxy in front of the gateway's store routes
 * (`Gotchu::StoreRoutesController` / `Gotchu::StoreRoutesService`):
 *
 *   GET /api/v1/accounts/:account_id/gotchu/store_routes
 *   PUT /api/v1/accounts/:account_id/gotchu/store_routes
 *
 * `get()` is inherited. `replace` sends the WHOLE mapping, every store of
 * the account: the proxy answers 409 `stores_changed` to a body missing
 * one. No channel and no actor travel from here -- the gateway reads the
 * channel from Chatwoot, and the controller takes the actor from the
 * session.
 */
class StoreRoutesAPI extends ApiClient {
  constructor() {
    super('gotchu/store_routes', { accountScoped: true });
  }

  /**
   * `stores`: [{ key, shop_emails: string[], inbox_ids: number[] }].
   *
   * `acknowledgeRemoved`, when non-empty, is the mapped-but-invisible inbox
   * ids the admin was shown (see InboxMapping.vue's unlisted-inbox notice)
   * and explicitly chose to drop -- sent as `acknowledge_removed`
   * (`store_routes_controller.rb#acknowledge_removed_param`). Left off the
   * body entirely when there is nothing to acknowledge, matching
   * `Gotchu::StoreRoutesService#replace`'s own "no key at all" behaviour one
   * hop further down, rather than sending an empty array that means the
   * same thing by a different route.
   */
  replace(stores, acknowledgeRemoved) {
    const body = { stores };
    if (acknowledgeRemoved?.length) {
      body.acknowledge_removed = acknowledgeRemoved;
    }
    return axios.put(this.url, body);
  }
}

export default new StoreRoutesAPI();
