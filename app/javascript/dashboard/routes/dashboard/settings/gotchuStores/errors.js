/**
 * What to say about a request that did not land, by the reason CODE Rails
 * gave -- never the gateway's own words, which
 * `Gotchu::StoreRoutesController` deliberately does not forward. An unknown
 * or missing reason reads as `unavailable`: "could not confirm", never a
 * guess at a cause nobody observed -- the same posture `PROCEDURE_ERROR_KEYS`
 * already takes in the procedures screen.
 *
 * `not_found` and `stores_changed` share one message: a store key the
 * gateway no longer recognises reads to the admin exactly like their store
 * set having changed since the page was opened, because in both cases the
 * fix is the same -- reload and try again.
 *
 * `unlisted_inbox_dropped` is NOT handled generically here. It carries the
 * exact inbox ids the save would have dropped
 * (`store_routes_controller.rb#render_unlisted_inbox_dropped`), and
 * InboxMapping.vue's save handler reads `error.response.data.inboxIds`
 * directly so it can name them; this entry is only the fallback used if
 * that extraction ever fails to find a shape it recognises.
 */
export const STORE_ROUTES_ERROR_KEYS = Object.freeze({
  unconfigured: 'GOTCHU_STORES.ERRORS.UNCONFIGURED',
  unavailable: 'GOTCHU_STORES.ERRORS.UNAVAILABLE',
  invalid: 'GOTCHU_STORES.ERRORS.INVALID',
  duplicate: 'GOTCHU_STORES.ERRORS.DUPLICATE',
  one_per_channel: 'GOTCHU_STORES.ERRORS.ONE_PER_CHANNEL',
  not_found: 'GOTCHU_STORES.ERRORS.STORES_CHANGED',
  stores_changed: 'GOTCHU_STORES.ERRORS.STORES_CHANGED',
  unconfirmed: 'GOTCHU_STORES.ERRORS.UNCONFIRMED',
  unlisted_inbox_dropped: 'GOTCHU_STORES.ERRORS.UNLISTED_INBOX_DROPPED',
});

export function storeRoutesErrorKey(error) {
  const reason = error?.response?.data?.reason;
  return STORE_ROUTES_ERROR_KEYS[reason] ?? STORE_ROUTES_ERROR_KEYS.unavailable;
}
