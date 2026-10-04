// One instance for the whole app, keyed by account, so a list of fifty
// conversation cards makes one request and an account switch never shows the
// previous account's dots.
import { useGotchuStores } from './useGotchuStores';

const shared = useGotchuStores();
let loadedFor = null;
let inFlight = null;

export const { stores, inboxes, storeIndex } = shared;

export const ensureLoaded = accountId => {
  if (loadedFor === accountId) return inFlight ?? Promise.resolve();
  loadedFor = accountId;
  shared.stores.value = [];
  shared.inboxes.value = [];
  inFlight = shared
    .load()
    .catch(() => {
      loadedFor = null;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};
