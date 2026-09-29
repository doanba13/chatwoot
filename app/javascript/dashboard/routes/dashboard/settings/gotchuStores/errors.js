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
  // The gateway's per-account save throttle (security review M1, final 6.3):
  // the proxy relays its 429 under this reason.
  too_many_saves: 'GOTCHU_STORES.ERRORS.TOO_MANY_SAVES',
});

export function storeRoutesErrorKey(error) {
  const reason = error?.response?.data?.reason;
  return STORE_ROUTES_ERROR_KEYS[reason] ?? STORE_ROUTES_ERROR_KEYS.unavailable;
}

/**
 * What to say when the screen's one READ did not land (final code review I1).
 * Never a save's words -- "did not confirm the change" describes a change,
 * and a read made none -- and never the NO_STORES empty state, which a failed
 * read used to fall through to: "connect a store first" sends an admin whose
 * stores are fine off to connect one again. Only two reasons can come back
 * from the list (the proxy's unconfigured and unavailable); anything else,
 * or no response at all, reads as unavailable.
 */
export const STORE_ROUTES_READ_ERROR_KEYS = Object.freeze({
  unconfigured: 'GOTCHU_STORES.LOAD_FAILED.UNCONFIGURED',
  unavailable: 'GOTCHU_STORES.LOAD_FAILED.UNAVAILABLE',
});

export function storeRoutesReadErrorKey(error) {
  const reason = error?.response?.data?.reason;
  return (
    STORE_ROUTES_READ_ERROR_KEYS[reason] ??
    STORE_ROUTES_READ_ERROR_KEYS.unavailable
  );
}
