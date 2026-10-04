import { scopeLabel, inboxOptions } from '../scopeView';

const ctx = {
  stores: [
    {
      key: 'persoliebe',
      name: 'persoliebe',
      inboxes: [
        { id: 2, channel: 'messenger' },
        { id: 4, channel: 'web' },
      ],
    },
    {
      key: 'paradisperso',
      name: 'paradisperso',
      inboxes: [{ id: 7, channel: 'web' }],
    },
  ],
  inboxes: [
    { id: 1, name: 'Support Mail', channel: 'email' },
    { id: 2, name: 'Messenger', channel: 'messenger' },
    { id: 4, name: 'Web chat', channel: 'web' },
    { id: 7, name: 'Web chat', channel: 'web' },
  ],
};

describe('scopeLabel', () => {
  it('names every store when the store is null', () => {
    expect(
      scopeLabel({ storeKey: null, inboxId: null, exceptInboxIds: [] }, ctx)
    ).toEqual({ store: null, inbox: null, except: [] });
  });

  it('names an inbox with its number, under its store', () => {
    expect(
      scopeLabel(
        { storeKey: 'persoliebe', inboxId: 2, exceptInboxIds: [] },
        ctx
      )
    ).toEqual({ store: 'persoliebe', inbox: 'Messenger #2', except: [] });
  });

  it('lists switched-off inboxes', () => {
    expect(
      scopeLabel(
        { storeKey: 'paradisperso', inboxId: null, exceptInboxIds: [7] },
        ctx
      ).except
    ).toEqual(['Web chat #7']);
  });

  it('keeps an inbox this account no longer lists as its number, not as a blank', () => {
    expect(
      scopeLabel(
        { storeKey: 'persoliebe', inboxId: 99, exceptInboxIds: [] },
        ctx
      ).inbox
    ).toBe('#99');
  });
});

describe('inboxOptions', () => {
  it('offers the store inboxes, then the shared mailbox under that store', () => {
    expect(inboxOptions('persoliebe', ctx)).toEqual([
      { value: 2, label: 'Messenger #2', shared: false },
      { value: 4, label: 'Web chat #4', shared: false },
      { value: 1, label: 'Support Mail #1', shared: true },
    ]);
  });

  it('never offers another store’s inbox', () => {
    expect(inboxOptions('persoliebe', ctx).map(o => o.value)).not.toContain(7);
  });
});
