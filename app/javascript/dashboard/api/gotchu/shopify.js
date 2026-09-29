/* global axios */

import ApiClient from '../ApiClient';

/**
 * The Rails proxy in front of the gateway's Shopify app routes
 * (`Gotchu::ShopifyController` / `Gotchu::ShopifyService`, item 6.4):
 *
 *   POST /api/v1/accounts/:account_id/gotchu/shopify/install
 *   POST /api/v1/accounts/:account_id/gotchu/shopify/complete
 *   GET  /api/v1/accounts/:account_id/gotchu/shopify/stores
 *   PUT  /api/v1/accounts/:account_id/gotchu/shopify/stores/:store_key/prefix
 *
 * Administrators only. Neither the actor nor the account travels from here:
 * the controller takes both from the session.
 */
class GotchuShopifyAPI extends ApiClient {
  constructor() {
    super('gotchu/shopify', { accountScoped: true });
  }

  install(shop) {
    return axios.post(`${this.url}/install`, { shop });
  }

  // `query` is Shopify's callback query as ONE string. The gateway checks its
  // HMAC; it must reach it untouched, so it is not parsed into a body object.
  complete(query) {
    return axios.post(`${this.url}/complete`, { query });
  }

  stores() {
    return axios.get(`${this.url}/stores`);
  }

  updatePrefix(storeKey, orderPrefix) {
    return axios.put(
      `${this.url}/stores/${encodeURIComponent(storeKey)}/prefix`,
      { order_prefix: orderPrefix }
    );
  }
}

export default new GotchuShopifyAPI();
