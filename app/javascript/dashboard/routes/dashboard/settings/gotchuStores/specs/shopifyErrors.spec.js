import {
  shopifyError,
  SHOPIFY_ERROR_KEYS,
  INSTALL_FAILED_REFERENCE_KEY,
} from '../shopifyErrors';
import en from 'dashboard/i18n/locale/en/gotchuShopify.json';
import de from 'dashboard/i18n/locale/de/gotchuShopify.json';
import fr from 'dashboard/i18n/locale/fr/gotchuShopify.json';

const withReason = (reason, extra = {}) => ({
  response: { data: { reason, ...extra } },
});

describe('#shopifyError', () => {
  it.each(Object.keys(SHOPIFY_ERROR_KEYS))(
    'maps %s to its own message',
    reason => {
      expect(shopifyError(withReason(reason)).key).toEqual(
        SHOPIFY_ERROR_KEYS[reason]
      );
    }
  );

  it('carries the gateway reference on a failed install', () => {
    expect(
      shopifyError(withReason('install_failed', { reference: 'abc-123' }))
    ).toEqual({
      key: INSTALL_FAILED_REFERENCE_KEY,
      params: { reference: 'abc-123' },
    });
  });

  it('reads an unknown reason and no response at all as unavailable', () => {
    expect(shopifyError(withReason('something_new')).key).toEqual(
      SHOPIFY_ERROR_KEYS.unavailable
    );
    expect(shopifyError(new Error('network down')).key).toEqual(
      SHOPIFY_ERROR_KEYS.unavailable
    );
    expect(shopifyError(undefined).key).toEqual(SHOPIFY_ERROR_KEYS.unavailable);
  });
});

describe('gotchuShopify copy', () => {
  const lookup = (catalogue, key) =>
    key.split('.').reduce((node, part) => node?.[part], catalogue);

  it.each([
    ['en', en],
    ['de', de],
    ['fr', fr],
  ])('has %s copy for every reason key', (_locale, catalogue) => {
    [
      ...Object.values(SHOPIFY_ERROR_KEYS),
      INSTALL_FAILED_REFERENCE_KEY,
    ].forEach(key => {
      expect(typeof lookup(catalogue, key)).toBe('string');
    });
  });
});
