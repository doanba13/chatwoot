import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { useAlert } from 'dashboard/composables';
import Index from '../Index.vue';

vi.mock('dashboard/api/gotchu/storeRoutes', () => ({
  default: { get: vi.fn(), replace: vi.fn() },
}));
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));

// The real catalogue: what matters here is which sentence the admin reads.
withFullI18n();

const NO_STORES = 'No Shopify store is connected';

const mountPage = async () => {
  const wrapper = mount(Index, {
    global: {
      // Page chrome this spec is not about; the body slot is rendered for real.
      stubs: {
        BaseSettingsHeader: true,
        InboxMapping: true,
        'woot-loading-state': true,
      },
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
    expect(text).toContain('Gotchu is not configured on this Chatwoot.');
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
});
