import { withFullI18n } from 'test-i18n';
import { headerMeta } from '../headerMeta';

const { t } = withFullI18n().global;
const stores = [
  { key: 'persoliebe', name: 'persoliebe' },
  { key: 'cadeauniq', name: 'cadeauniq' },
];

describe('headerMeta', () => {
  it('reads store · channel · language', () => {
    expect(
      headerMeta({
        storeKey: 'persoliebe',
        stores,
        draftMeta: { channel: 'email', lang: 'de' },
        inboxChannelType: 'Channel::Email',
        t,
      })
    ).toMatchObject({ line: 'persoliebe · Email · German', storeIndex: 1 });
  });

  it('falls back to the inbox for the channel and leaves language out on an older gateway', () => {
    expect(
      headerMeta({
        storeKey: 'cadeauniq',
        stores,
        draftMeta: null,
        inboxChannelType: 'Channel::FacebookPage',
        t,
      }).line
    ).toBe('cadeauniq · Messenger');
  });

  it('omits a channel the gateway calls other, without falling back to the inbox', () => {
    expect(
      headerMeta({
        storeKey: 'persoliebe',
        stores,
        draftMeta: { channel: 'other', lang: 'de' },
        inboxChannelType: 'Channel::Email',
        t,
      }).line
    ).toBe('persoliebe · German');
  });

  it('shows no store for a conversation not yet attributed', () => {
    expect(
      headerMeta({
        storeKey: null,
        stores,
        draftMeta: { channel: 'web', lang: null },
        inboxChannelType: 'Channel::WebWidget',
        t,
      })
    ).toMatchObject({ line: 'Web chat', storeIndex: null, storeName: null });
  });

  it('treats a meta holding only threadAvailable like no meta', () => {
    expect(
      headerMeta({
        storeKey: 'persoliebe',
        stores,
        draftMeta: { threadAvailable: true },
        inboxChannelType: 'Channel::Email',
        t,
      })
    ).toMatchObject({ line: 'persoliebe · Email', language: null });
  });

  it('leaves out an unknown inbox type and has no dangling separator', () => {
    expect(
      headerMeta({
        storeKey: null,
        stores,
        draftMeta: null,
        inboxChannelType: 'Channel::Api',
        t,
      }).line
    ).toBe('');
  });
});
