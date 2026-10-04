import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { useAlert } from 'dashboard/composables';
import GotchuShopifyAPI from 'dashboard/api/gotchu/shopify';
import Index from '../Index.vue';

vi.mock('dashboard/api/gotchu/storeRoutes', () => ({
  default: { get: vi.fn(), replace: vi.fn() },
}));
vi.mock('dashboard/api/gotchu/shopify', () => ({
  default: { stores: vi.fn(), complete: vi.fn() },
}));
vi.mock('vue-router', async importOriginal => ({
  ...(await importOriginal()),
  useRoute: () => ({ query: { shopify_return: '1', code: 'c', state: 's' } }),
  useRouter: () => ({ replace: vi.fn() }),
}));
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));

// The real catalogue: what matters here is which sentence the admin reads.
withFullI18n();

const NO_STORES = 'No Shopify store is connected';

const PAGE_STUBS = {
  BaseSettingsHeader: true,
  InboxMapping: true,
  'woot-loading-state': true,
};

const mountPage = async () => {
  const wrapper = mount(Index, {
    global: {
      // Page chrome this spec is not about; the body slot is rendered for real.
      stubs: PAGE_STUBS,
    },
  });
  await flushPromises();
  return wrapper;
};

const failWith = (status, data) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  StoreRoutesAPI.get.mockRejectedValue(error);
};

describe('Gotchu stores page (Index.vue)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GotchuShopifyAPI.stores.mockResolvedValue({
      data: { stores: [], capabilities: { shopify_app: false } },
    });
  });

  // Final code review I1: a failed read used to leave `available` true and
  // `stores` empty, so the admin was told to connect a store they already
  // have -- plus a toast about a change nobody made.
  it('says it could not load the stores, and why, when the read fails', async () => {
    failWith(502, {
      error: 'Gotchu did not confirm the request',
      reason: 'unavailable',
    });
    const text = (await mountPage()).text();
    expect(text).toContain('Could not load your stores');
    expect(text).toContain(
      'Gotchu did not answer. Reload the page to try again.'
    );
    expect(text).not.toContain(NO_STORES);
    expect(useAlert).not.toHaveBeenCalled();
  });

  it('names an unconfigured gateway as the reason when the read says so', async () => {
    failWith(503, {
      error: 'Gotchu is not configured',
      reason: 'unconfigured',
    });
    const text = (await mountPage()).text();
    expect(text).toContain('Could not load your stores');
    expect(text).toContain('Gotchu is not configured on this desk.');
    expect(text).not.toContain(NO_STORES);
  });

  it('reads a refusal with no reason (not an administrator) as unavailable, not as no stores', async () => {
    failWith(401, { error: 'You are not authorized to do this action' });
    const text = (await mountPage()).text();
    expect(text).toContain('Could not load your stores');
    expect(text).not.toContain(NO_STORES);
  });

  // The counterweight: a read that DID answer with no stores still shows the
  // empty state, or the fix could just be "never show NO_STORES".
  it('still shows the connect-a-store empty state when the read answered with no stores', async () => {
    StoreRoutesAPI.get.mockResolvedValue({
      data: { stores: [], inboxes: [], capabilities: { store_routes: true } },
    });
    const text = (await mountPage()).text();
    expect(text).toContain(NO_STORES);
    expect(text).not.toContain('Could not load your stores');
  });

  // A15: the Connect form is what a merchant with no store needs, so it must
  // not live inside the branch that only renders once a store exists.
  it('mounts the Connect section even when the account has no stores', async () => {
    StoreRoutesAPI.get.mockResolvedValue({
      data: { stores: [], inboxes: [], capabilities: { store_routes: true } },
    });
    GotchuShopifyAPI.stores.mockResolvedValue({
      data: { stores: [], capabilities: { shopify_app: true } },
    });
    GotchuShopifyAPI.complete.mockResolvedValue({
      data: { storeKey: 'acme', prefixNeedsReview: false },
    });
    const wrapper = await mountPage();
    expect(wrapper.findComponent({ name: 'ShopifyStores' }).exists()).toBe(
      true
    );
  });

  // Finding 2: a zero-store merchant used to read "Connected acme." over "No
  // Shopify store is connected", and could not map the new store's inboxes.
  it('re-reads the store routes after a successful install, without remounting the section', async () => {
    StoreRoutesAPI.get
      .mockResolvedValueOnce({
        data: { stores: [], inboxes: [], capabilities: { store_routes: true } },
      })
      .mockResolvedValue({
        data: {
          stores: [{ key: 'acme', name: 'Acme', shopEmails: [], inboxes: [] }],
          inboxes: [],
          capabilities: { store_routes: true },
        },
      });
    GotchuShopifyAPI.stores.mockResolvedValue({
      data: { stores: [], capabilities: { shopify_app: true } },
    });
    GotchuShopifyAPI.complete.mockResolvedValue({
      data: { storeKey: 'acme', prefixNeedsReview: false },
    });
    const wrapper = mount(Index, { global: { stubs: PAGE_STUBS } });
    await flushPromises();
    const sectionUid = wrapper.findComponent({ name: 'ShopifyStores' }).vm.$
      .uid;
    await flushPromises();
    expect(GotchuShopifyAPI.complete).toHaveBeenCalledTimes(1);
    expect(StoreRoutesAPI.get).toHaveBeenCalledTimes(2);
    expect(wrapper.findComponent({ name: 'ShopifyStores' }).vm.$.uid).toBe(
      sectionUid
    );
    expect(wrapper.text()).toContain('Connected acme.');
    expect(wrapper.text()).not.toContain(NO_STORES);
    expect(wrapper.findComponent({ name: 'InboxMapping' }).exists()).toBe(true);
  });
});
