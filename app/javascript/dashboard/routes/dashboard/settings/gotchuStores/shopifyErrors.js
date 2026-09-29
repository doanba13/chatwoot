/**
 * What to say about a Shopify request that did not land, by the reason CODE
 * `Gotchu::ShopifyController` gave -- never the gateway's own words, which the
 * proxy does not forward. An unknown or missing reason reads as `unavailable`:
 * "could not confirm", never a guess at a cause nobody observed (the same
 * posture as ./errors.js).
 *
 * `install_failed` is special: the gateway keeps the cause to itself and
 * hands back a reference the admin can quote, so it picks a message with a
 * slot for it when there is one.
 */
export const SHOPIFY_ERROR_KEYS = Object.freeze({
  unconfigured: 'GOTCHU_SHOPIFY.ERRORS.UNCONFIGURED',
  unavailable: 'GOTCHU_SHOPIFY.ERRORS.UNAVAILABLE',
  invalid_shop: 'GOTCHU_SHOPIFY.ERRORS.INVALID_SHOP',
  invalid_prefix: 'GOTCHU_SHOPIFY.ERRORS.INVALID_PREFIX',
  invalid_query: 'GOTCHU_SHOPIFY.ERRORS.INVALID_QUERY',
  not_found: 'GOTCHU_SHOPIFY.ERRORS.NOT_FOUND',
  prefix_unavailable: 'GOTCHU_SHOPIFY.ERRORS.PREFIX_UNAVAILABLE',
  too_many_saves: 'GOTCHU_SHOPIFY.ERRORS.TOO_MANY_SAVES',
  install_failed: 'GOTCHU_SHOPIFY.ERRORS.INSTALL_FAILED',
});

export const INSTALL_FAILED_REFERENCE_KEY =
  'GOTCHU_SHOPIFY.ERRORS.INSTALL_FAILED_REFERENCE';

/** `{ key, params }` for `t(key, params)`. */
export function shopifyError(error) {
  const data = error?.response?.data;
  if (data?.reason === 'install_failed' && typeof data.reference === 'string') {
    return {
      key: INSTALL_FAILED_REFERENCE_KEY,
      params: { reference: data.reference },
    };
  }
  return {
    key: SHOPIFY_ERROR_KEYS[data?.reason] ?? SHOPIFY_ERROR_KEYS.unavailable,
    params: {},
  };
}
