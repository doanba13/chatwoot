/**
 * Pure helpers behind the Gotchu stores screen. Kept out of the `.vue`
 * files so the logic that decides what gets saved -- never what merely gets
 * rendered -- has a spec of its own (specs/mapping.spec.js).
 */

// Not a store key: the choice meaning "this inbox identifies no single
// store". A picker's modelValue has no null, so the sentinel lives here,
// the one place both the components and the spec import it from.
export const SHARED = '__shared__';

// The gateway's MAX_SHOP_EMAILS_PER_STORE (global-constraints.md); it
// refuses a 21st either way, so the screen disables adding one rather than
// letting the round trip be the first place the admin hears about the cap.
export const MAX_SHOP_EMAILS = 20;

/**
 * Seeds the picker state from a GET response: every LIVE inbox defaults to
 * whichever store's own `inboxes` list already claims it, or SHARED when
 * none does.
 */
export function initialAssignment(stores, inboxes) {
  const storeOfInbox = Object.fromEntries(
    stores.flatMap(store =>
      (store.inboxes || []).map(inbox => [inbox.id, store.key])
    )
  );
  return Object.fromEntries(
    inboxes.map(inbox => [inbox.id, storeOfInbox[inbox.id] ?? SHARED])
  );
}

export function initialShopEmails(stores) {
  return Object.fromEntries(
    stores.map(store => [store.key, [...(store.shopEmails || [])]])
  );
}

/**
 * A store's own mapped inbox that Chatwoot's live list no longer shows --
 * deleted, or invisible to this account's Gotchu user (CLAUDE.md's
 * "inboxIds was empty" gotcha, reached again through a stale or non-admin
 * token). Carries the channel and store name from the STORE's own copy,
 * since that is the only place left holding either once the inbox has
 * dropped out of the live list.
 */
export function unlistedInboxes(stores, inboxes) {
  const liveIds = new Set(inboxes.map(inbox => inbox.id));
  return stores.flatMap(store =>
    (store.inboxes || [])
      .filter(inbox => !liveIds.has(inbox.id))
      .map(inbox => ({
        id: inbox.id,
        channel: inbox.channel,
        storeKey: store.key,
        storeName: store.name,
      }))
  );
}

/**
 * Spec §2: with two or more stores, an email inbox given to ONE store is
 * usually the shared mailbox. Confirm, never refuse -- one mailbox per shop
 * is legitimate.
 */
export function needsSharedWarning({ storeCount, channel, storeKey }) {
  return storeCount >= 2 && channel === 'email' && storeKey !== SHARED;
}

/**
 * The PUT body, in the shape the Rails proxy reads
 * (`store_routes_controller.rb#stores_param`): snake_case, every store of
 * the account, every time -- the proxy forwards a body missing one straight
 * into the gateway's own `stores_changed` refusal.
 *
 * A mapped-but-unlisted inbox (see `unlistedInboxes`) is carried forward
 * under its current store automatically, UNLESS its id is in
 * `removedIds` (a Set) -- this function is the only place `inbox_ids` is
 * built, so there is no second path where one could be dropped silently by
 * omission.
 */
export function buildStorePayload({
  stores,
  inboxes,
  assignment,
  shopEmails,
  unlisted,
  removedIds,
}) {
  return stores.map(store => ({
    key: store.key,
    shop_emails: shopEmails[store.key] || [],
    inbox_ids: [
      ...inboxes
        .filter(inbox => assignment[inbox.id] === store.key)
        .map(inbox => inbox.id),
      ...unlisted
        .filter(item => item.storeKey === store.key && !removedIds.has(item.id))
        .map(item => item.id),
    ],
  }));
}
