import {
  storeRoutesErrorKey,
  storeRoutesReadErrorKey,
  STORE_ROUTES_ERROR_KEYS,
  STORE_ROUTES_READ_ERROR_KEYS,
} from '../errors';
import en from 'dashboard/i18n/locale/en/gotchuStores.json';
import de from 'dashboard/i18n/locale/de/gotchuStores.json';
import fr from 'dashboard/i18n/locale/fr/gotchuStores.json';

const errorWithReason = reason => ({ response: { data: { reason } } });

describe('#storeRoutesErrorKey', () => {
  it('maps every reason code the controller can answer with, to its own message', () => {
    expect(storeRoutesErrorKey(errorWithReason('unconfigured'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.unconfigured
    );
    expect(storeRoutesErrorKey(errorWithReason('unavailable'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.unavailable
    );
    expect(storeRoutesErrorKey(errorWithReason('invalid'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.invalid
    );
    expect(storeRoutesErrorKey(errorWithReason('duplicate'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.duplicate
    );
    expect(storeRoutesErrorKey(errorWithReason('one_per_channel'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.one_per_channel
    );
    expect(storeRoutesErrorKey(errorWithReason('not_found'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.not_found
    );
    expect(storeRoutesErrorKey(errorWithReason('stores_changed'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.stores_changed
    );
    expect(storeRoutesErrorKey(errorWithReason('unconfirmed'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.unconfirmed
    );
    expect(
      storeRoutesErrorKey(errorWithReason('unlisted_inbox_dropped'))
    ).toEqual(STORE_ROUTES_ERROR_KEYS.unlisted_inbox_dropped);
  });

  it('has its own message for every reason, not the unavailable fallback', () => {
    Object.entries(STORE_ROUTES_ERROR_KEYS)
      .filter(([reason]) => !['unavailable', 'not_found'].includes(reason))
      .forEach(([, key]) => {
        expect(key).not.toEqual(STORE_ROUTES_ERROR_KEYS.unavailable);
      });
  });

  it('reads not_found the same as stores_changed -- both mean "reload and try again"', () => {
    expect(storeRoutesErrorKey(errorWithReason('not_found'))).toEqual(
      storeRoutesErrorKey(errorWithReason('stores_changed'))
    );
  });

  it('falls back to unavailable on an unrecognised reason', () => {
    expect(storeRoutesErrorKey(errorWithReason('something_new'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.unavailable
    );
  });

  it('falls back to unavailable when there is no response at all', () => {
    expect(storeRoutesErrorKey(new Error('network down'))).toEqual(
      STORE_ROUTES_ERROR_KEYS.unavailable
    );
    expect(storeRoutesErrorKey(undefined)).toEqual(
      STORE_ROUTES_ERROR_KEYS.unavailable
    );
  });

  it('falls back to unavailable when the response carries no reason', () => {
    expect(storeRoutesErrorKey({ response: { data: {} } })).toEqual(
      STORE_ROUTES_ERROR_KEYS.unavailable
    );
  });
});

describe('#storeRoutesReadErrorKey', () => {
  // A failed READ must never borrow a save's words ("did not confirm the
  // change") -- nothing was changed -- nor fall through to the empty state.
  it('says why the stores could not be loaded, by reason', () => {
    expect(storeRoutesReadErrorKey(errorWithReason('unconfigured'))).toEqual(
      STORE_ROUTES_READ_ERROR_KEYS.unconfigured
    );
    expect(storeRoutesReadErrorKey(errorWithReason('unavailable'))).toEqual(
      STORE_ROUTES_READ_ERROR_KEYS.unavailable
    );
  });

  it('reads anything else, and no response at all, as unavailable', () => {
    expect(storeRoutesReadErrorKey(errorWithReason('invalid'))).toEqual(
      STORE_ROUTES_READ_ERROR_KEYS.unavailable
    );
    expect(storeRoutesReadErrorKey(new Error('network down'))).toEqual(
      STORE_ROUTES_READ_ERROR_KEYS.unavailable
    );
  });

  it('never answers with a save message', () => {
    Object.values(STORE_ROUTES_READ_ERROR_KEYS).forEach(key => {
      expect(Object.values(STORE_ROUTES_ERROR_KEYS)).not.toContain(key);
    });
  });
});

describe('gotchuStores copy', () => {
  const lookup = (catalogue, key) =>
    key.split('.').reduce((node, part) => node?.[part], catalogue);

  it.each([
    ['en', en],
    ['de', de],
    ['fr', fr],
  ])(
    'has %s copy for every reason key, save and read',
    (_locale, catalogue) => {
      [
        ...Object.values(STORE_ROUTES_ERROR_KEYS),
        ...Object.values(STORE_ROUTES_READ_ERROR_KEYS),
        'GOTCHU_STORES.LOAD_FAILED.TITLE',
      ].forEach(key => {
        expect(typeof lookup(catalogue, key)).toBe('string');
      });
    }
  );
});
