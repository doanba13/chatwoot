import { storeRoutesErrorKey, STORE_ROUTES_ERROR_KEYS } from '../errors';

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
