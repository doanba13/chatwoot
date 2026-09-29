import {
  SHARED,
  initialAssignment,
  initialShopEmails,
  unlistedInboxes,
  needsSharedWarning,
  buildStorePayload,
} from '../mapping';

const stores = [
  {
    key: 'persoliebe',
    name: 'Persoliebe',
    shopEmails: ['kontakt@persoliebe.com'],
    inboxes: [{ id: 2, channel: 'messenger' }],
  },
  {
    key: 'cadeauniq',
    name: 'Cadeauniq',
    shopEmails: [],
    inboxes: [{ id: 3, channel: 'web' }],
  },
];

const inboxes = [
  { id: 1, name: 'Support Mail', channel: 'email' },
  { id: 2, name: 'PL Messenger', channel: 'messenger' },
  { id: 3, name: 'CU Widget', channel: 'web' },
];

describe('#initialAssignment', () => {
  it('assigns a mapped inbox to the store that names it', () => {
    expect(initialAssignment(stores, inboxes)).toEqual({
      1: SHARED,
      2: 'persoliebe',
      3: 'cadeauniq',
    });
  });

  it('defaults every unmapped inbox to SHARED', () => {
    expect(initialAssignment([], inboxes)).toEqual({
      1: SHARED,
      2: SHARED,
      3: SHARED,
    });
  });
});

describe('#initialShopEmails', () => {
  it('copies the shop emails already on each store', () => {
    expect(initialShopEmails(stores)).toEqual({
      persoliebe: ['kontakt@persoliebe.com'],
      cadeauniq: [],
    });
  });

  it('never hands back the store’s own array reference', () => {
    const [seeded] = Object.values(initialShopEmails(stores));
    expect(seeded).not.toBe(stores[0].shopEmails);
  });

  it('treats a store with no shopEmails key as having none', () => {
    expect(initialShopEmails([{ key: 'x', name: 'X' }])).toEqual({ x: [] });
  });
});

describe('#unlistedInboxes', () => {
  it('finds no unlisted inbox when every mapped id is still live', () => {
    expect(unlistedInboxes(stores, inboxes)).toEqual([]);
  });

  it('reports a mapped inbox missing from the live list, with its channel and store', () => {
    const liveMinusOne = inboxes.filter(inbox => inbox.id !== 2);
    expect(unlistedInboxes(stores, liveMinusOne)).toEqual([
      {
        id: 2,
        channel: 'messenger',
        storeKey: 'persoliebe',
        storeName: 'Persoliebe',
      },
    ]);
  });

  it('reports one entry per store when more than one store has lost an inbox', () => {
    expect(unlistedInboxes(stores, [])).toEqual([
      {
        id: 2,
        channel: 'messenger',
        storeKey: 'persoliebe',
        storeName: 'Persoliebe',
      },
      { id: 3, channel: 'web', storeKey: 'cadeauniq', storeName: 'Cadeauniq' },
    ]);
  });
});

describe('#needsSharedWarning', () => {
  it('warns on an email inbox given to one store, with two or more stores', () => {
    expect(
      needsSharedWarning({
        storeCount: 2,
        channel: 'email',
        storeKey: 'persoliebe',
      })
    ).toBe(true);
  });

  it('does not warn with a single store', () => {
    expect(
      needsSharedWarning({
        storeCount: 1,
        channel: 'email',
        storeKey: 'persoliebe',
      })
    ).toBe(false);
  });

  it('does not warn on a non-email channel', () => {
    expect(
      needsSharedWarning({
        storeCount: 2,
        channel: 'messenger',
        storeKey: 'persoliebe',
      })
    ).toBe(false);
  });

  it('does not warn when the pick is Shared itself', () => {
    expect(
      needsSharedWarning({ storeCount: 2, channel: 'email', storeKey: SHARED })
    ).toBe(false);
  });
});

describe('#buildStorePayload', () => {
  const basePayload = overrides =>
    buildStorePayload({
      stores,
      inboxes,
      assignment: { 1: SHARED, 2: 'persoliebe', 3: 'cadeauniq' },
      shopEmails: { persoliebe: ['kontakt@persoliebe.com'], cadeauniq: [] },
      unlisted: [],
      removedIds: new Set(),
      ...overrides,
    });

  it('lists every store, with its live inboxes and shop emails', () => {
    expect(basePayload()).toEqual([
      {
        key: 'persoliebe',
        shop_emails: ['kontakt@persoliebe.com'],
        inbox_ids: [2],
      },
      { key: 'cadeauniq', shop_emails: [], inbox_ids: [3] },
    ]);
  });

  it('carries a mapped-but-unlisted inbox forward under its current store', () => {
    const unlisted = [
      {
        id: 9,
        channel: 'email',
        storeKey: 'persoliebe',
        storeName: 'Persoliebe',
      },
    ];
    const payload = basePayload({ unlisted });
    const persoliebe = payload.find(store => store.key === 'persoliebe');
    expect(persoliebe.inbox_ids).toEqual(expect.arrayContaining([2, 9]));
  });

  it('drops an unlisted inbox only once it is in removedIds', () => {
    const unlisted = [
      {
        id: 9,
        channel: 'email',
        storeKey: 'persoliebe',
        storeName: 'Persoliebe',
      },
    ];
    const payload = basePayload({ unlisted, removedIds: new Set([9]) });
    const persoliebe = payload.find(store => store.key === 'persoliebe');
    expect(persoliebe.inbox_ids).toEqual([2]);
  });

  it('never assigns an unlisted inbox to a store other than the one it was on', () => {
    const unlisted = [
      {
        id: 9,
        channel: 'email',
        storeKey: 'persoliebe',
        storeName: 'Persoliebe',
      },
    ];
    const payload = basePayload({ unlisted });
    const cadeauniq = payload.find(store => store.key === 'cadeauniq');
    expect(cadeauniq.inbox_ids).not.toContain(9);
  });
});
