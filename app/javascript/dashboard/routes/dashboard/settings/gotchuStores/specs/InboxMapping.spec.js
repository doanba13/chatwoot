import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import StoreRoutesAPI from 'dashboard/api/gotchu/storeRoutes';
import { useAlert } from 'dashboard/composables';
import InboxMapping from '../InboxMapping.vue';

vi.mock('dashboard/api/gotchu/storeRoutes', () => ({
  default: { get: vi.fn(), replace: vi.fn() },
}));
vi.mock('dashboard/composables', () => ({ useAlert: vi.fn() }));

withFullI18n();

const STORES = [
  {
    key: 'persoliebe',
    name: 'Persoliebe',
    shopEmails: [],
    inboxes: [{ id: 2, channel: 'messenger' }],
  },
];
const INBOXES = [{ id: 2, name: 'PL Messenger', channel: 'messenger' }];

const mountSection = () =>
  mount(InboxMapping, {
    props: { stores: STORES, inboxes: INBOXES },
    global: {
      // The form controls are not what this spec is about; the Save button is
      // rendered for real so the click goes through the component's handler.
      stubs: {
        Select: true,
        TagInput: true,
        Dialog: true,
        BaseTable: true,
      },
    },
  });

const pressSave = async wrapper => {
  const save = wrapper
    .findAll('button')
    .find(button => button.text() === 'Save mapping');
  await save.trigger('click');
  await flushPromises();
};

const refuseWith = (status, data) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data };
  StoreRoutesAPI.replace.mockRejectedValue(error);
};

describe('Gotchu stores mapping section (InboxMapping.vue)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Final code review T6: the defensive branch for a save refused because it
  // would drop an inbox the admin never acknowledged. It must name the ids
  // the 409 carried, not fall back to a generic message.
  it('names the inbox ids a 409 unlisted_inbox_dropped carried', async () => {
    refuseWith(409, {
      error: 'unlisted_inbox_dropped',
      reason: 'unlisted_inbox_dropped',
      inboxIds: [99, 101],
    });
    const wrapper = mountSection();
    await pressSave(wrapper);
    expect(useAlert).toHaveBeenCalledTimes(1);
    expect(useAlert).toHaveBeenCalledWith(
      'Inbox 99, 101 is no longer visible and was not acknowledged for removal. Reload the page and decide again.'
    );
    expect(wrapper.emitted('updated')).toBeUndefined();
  });

  it('tells the admin to wait when the gateway throttled the save', async () => {
    refuseWith(429, { error: 'Too many saves', reason: 'too_many_saves' });
    await pressSave(mountSection());
    expect(useAlert).toHaveBeenCalledWith(
      'Too many saves in a short time. Wait a minute, then save again.'
    );
  });

  it('emits the saved mapping and says so on success', async () => {
    const saved = { stores: STORES, inboxes: INBOXES };
    StoreRoutesAPI.replace.mockResolvedValue({ data: saved });
    const wrapper = mountSection();
    await pressSave(wrapper);
    expect(StoreRoutesAPI.replace).toHaveBeenCalledWith(
      [{ key: 'persoliebe', shop_emails: [], inbox_ids: [2] }],
      []
    );
    expect(wrapper.emitted('updated')).toEqual([[saved]]);
  });
});
