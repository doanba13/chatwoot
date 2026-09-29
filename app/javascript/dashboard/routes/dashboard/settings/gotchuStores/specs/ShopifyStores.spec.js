import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import GotchuShopifyAPI from 'dashboard/api/gotchu/shopify';
import { useAlert } from 'dashboard/composables';
import ShopifyStores from '../ShopifyStores.vue';

vi.mock('dashboard/api/gotchu/shopify', () => ({
  default: {
    stores: vi.fn(),
    install: vi.fn(),
    complete: vi.fn(),
    updatePrefix: vi.fn(),
  },
}));
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));

let routeQuery = {};
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery }),
}));

withFullI18n();

const STORE = {
  key: 'acme',
  name: 'Acme',
  shopDomain: 'acme.myshopify.com',
  orderPrefix: 'AC',
  status: 'active',
  auth: 'oauth',
};
const LIVE = { data: { stores: [STORE], capabilities: { shopify_app: true } } };
const DARK = { data: { stores: [], capabilities: { shopify_app: false } } };
const AUTHORIZE =
  'https://acme.myshopify.com/admin/oauth/authorize?client_id=c&state=s';

const mountSection = async () => {
  const wrapper = mount(ShopifyStores, {
    global: { stubs: { Button: false } },
  });
  await flushPromises();
  return wrapper;
};

describe('Connect a Shopify store (ShopifyStores.vue)', () => {
  let calls;
  let assign;
  let replaceState;

  beforeEach(() => {
    vi.clearAllMocks();
    routeQuery = {};
    calls = [];
    assign = vi.fn();
    replaceState = vi
      .spyOn(window.history, 'replaceState')
      .mockImplementation(() => calls.push('replaceState'));
    vi.stubGlobal('location', {
      ...window.location,
      pathname: '/app/accounts/1/settings/gotchu-stores',
      hash: '',
      assign,
    });
    GotchuShopifyAPI.stores.mockResolvedValue(LIVE);
  });

  afterEach(() => {
    replaceState.mockRestore();
    vi.unstubAllGlobals();
  });

  // A14 / M18: an app that is dark by design is not a failure to announce.
  it('renders no Connect form and no toast when the Shopify app is not available', async () => {
    GotchuShopifyAPI.stores.mockResolvedValue(DARK);
    const wrapper = await mountSection();
    expect(wrapper.find('form').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
    expect(useAlert).not.toHaveBeenCalled();
  });

  it('renders the connected stores and the Connect form when it is', async () => {
    const wrapper = await mountSection();
    expect(wrapper.text()).toContain('Acme');
    expect(wrapper.text()).toContain('acme.myshopify.com');
    expect(wrapper.text()).toContain('Connect a Shopify store');
  });

  it('rejects a non-myshopify authorize URL without navigating', async () => {
    GotchuShopifyAPI.install.mockResolvedValue({
      data: { authorizeUrl: 'https://evil.test/admin/oauth/authorize?x=1' },
    });
    const wrapper = await mountSection();
    await wrapper.find('input[type="text"]').setValue('acme');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(assign).not.toHaveBeenCalled();
    expect(useAlert).toHaveBeenCalledTimes(1);
  });

  it('navigates the top-level window to a genuine Shopify authorize URL', async () => {
    GotchuShopifyAPI.install.mockResolvedValue({
      data: { authorizeUrl: AUTHORIZE },
    });
    const wrapper = await mountSection();
    await wrapper.find('input[type="text"]').setValue('acme');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(GotchuShopifyAPI.install).toHaveBeenCalledWith('acme');
    expect(assign).toHaveBeenCalledWith(AUTHORIZE);
  });

  describe('when Shopify returns the merchant (shopify_return)', () => {
    beforeEach(() => {
      routeQuery = {
        shopify_return: '1',
        code: 'c0de',
        hmac: 'abc',
        shop: 'acme.myshopify.com',
        state: 's',
        timestamp: '1',
      };
    });

    it('drops the query from the address bar before it posts, and posts none of shopify_return', async () => {
      GotchuShopifyAPI.complete.mockImplementation(async query => {
        calls.push('complete');
        expect(query).toBe(
          'code=c0de&hmac=abc&shop=acme.myshopify.com&state=s&timestamp=1'
        );
        return { data: { storeKey: 'acme', prefixNeedsReview: false } };
      });
      await mountSection();
      expect(calls).toEqual(['replaceState', 'complete']);
      const [, , url] = replaceState.mock.calls[0];
      expect(url).toBe('/app/accounts/1/settings/gotchu-stores');
      expect(GotchuShopifyAPI.complete.mock.calls[0][0]).not.toContain(
        'shopify_return'
      );
    });

    it('shows the connected store, and the prefix review sentence when asked', async () => {
      GotchuShopifyAPI.complete.mockResolvedValue({
        data: { storeKey: 'acme', prefixNeedsReview: true },
      });
      const text = (await mountSection()).text();
      expect(text).toContain('Connected acme.');
      expect(text).toContain('Check its order prefix below');
    });

    it('does not ask for a prefix review when none is needed', async () => {
      GotchuShopifyAPI.complete.mockResolvedValue({
        data: { storeKey: 'acme', prefixNeedsReview: false },
      });
      const text = (await mountSection()).text();
      expect(text).toContain('Connected acme.');
      expect(text).not.toContain('Check its order prefix below');
    });

    it('says the store could not be connected, with the reference, when the install failed', async () => {
      const error = new Error('Request failed with status code 422');
      error.response = {
        status: 422,
        data: { reason: 'install_failed', reference: 'ref-42' },
      };
      GotchuShopifyAPI.complete.mockRejectedValue(error);
      const text = (await mountSection()).text();
      expect(text).not.toContain('Connected acme.');
      expect(useAlert).toHaveBeenCalledWith(expect.stringContaining('ref-42'));
    });

    it('never posts a query when the URL carries no shopify_return', async () => {
      routeQuery = { connected: 'acme' };
      await mountSection();
      expect(GotchuShopifyAPI.complete).not.toHaveBeenCalled();
      expect(replaceState).not.toHaveBeenCalled();
    });
  });
});
