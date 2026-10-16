import {
  QUEUES,
  queueFolder,
  filtersFor,
  queueTabs,
  storeFolder,
  sameFolder,
} from './queues';
import { matchesFilters } from 'dashboard/store/modules/conversations/helpers/filterHelpers';

// The payload shape is the one a saved folder stores (filterQueryGenerator):
// attribute_key, filter_operator, values, query_operator, with no operator on
// the last row. The backend filter cannot take two values for one custom
// attribute (it keeps only the first), and it concatenates conditions with
// AND binding tighter than OR, so "open and (drafted or handed_over)" is
// written out as "open and drafted or open and handed_over".
const open = {
  attribute_key: 'status',
  filter_operator: 'equal_to',
  values: ['open'],
  query_operator: 'and',
};
const state = (value, queryOperator) => ({
  attribute_key: 'gotchu_state',
  filter_operator: 'equal_to',
  values: [value],
  query_operator: queryOperator,
});

const stateAnd = value => state(value, 'and');
const mine = (userId, queryOperator) => ({
  attribute_key: 'assignee_id',
  filter_operator: 'equal_to',
  values: [userId],
  query_operator: queryOperator,
});
const unassigned = queryOperator => ({
  attribute_key: 'assignee_id',
  filter_operator: 'is_not_present',
  values: [],
  query_operator: queryOperator,
});

describe('queueFolder', () => {
  it('builds Needs you as open, drafted or handed over, and mine or unassigned', () => {
    // AND binds tighter than OR on both the backend and the in-memory filter,
    // so each (state, assignee) pair is its own AND group.
    expect(queueFolder('needs_you', key => key, 42).query.payload).toEqual([
      open,
      stateAnd('drafted'),
      mine(42, 'or'),
      open,
      stateAnd('drafted'),
      unassigned('or'),
      open,
      stateAnd('handed_over'),
      mine(42, 'or'),
      open,
      stateAnd('handed_over'),
      unassigned(null),
    ]);
  });

  it('builds Needs you account-wide when no user is known', () => {
    expect(queueFolder('needs_you', key => key).query.payload).toEqual([
      open,
      state('drafted', 'or'),
      open,
      state('handed_over', null),
    ]);
  });

  it.each([['drafted'], ['auto_holding'], ['handed_over']])(
    'keeps %s account-wide even when a user is known',
    queue => {
      expect(queueFolder(queue, key => key, 42).query.payload).toEqual([
        open,
        state(queue, null),
      ]);
    }
  );

  it.each([['drafted'], ['auto_holding'], ['handed_over']])(
    'builds %s from that state alone, on open conversations',
    queue => {
      expect(queueFolder(queue, key => key).query.payload).toEqual([
        open,
        state(queue, null),
      ]);
    }
  );

  it('names each queue through i18n', () => {
    expect(queueFolder('needs_you', key => `t:${key}`).name).toBe(
      't:SIDEBAR.QUEUE_NEEDS_YOU'
    );
  });

  it('gives a queue an id no saved folder can have', () => {
    expect(queueFolder('drafted', key => key).id).toBe('queue:drafted');
  });

  it('returns undefined for a queue it does not know', () => {
    expect(queueFolder('anything', key => key)).toBeUndefined();
  });

  it('lists the four queues in rail order', () => {
    expect(QUEUES.map(q => q.key)).toEqual([
      'needs_you',
      'drafted',
      'auto_holding',
      'handed_over',
    ]);
  });

  describe('against the in-memory filter the folder path applies', () => {
    const conversation = (status, gotchuState, assignee = null) => ({
      id: 1,
      status,
      custom_attributes: gotchuState ? { gotchu_state: gotchuState } : {},
      meta: assignee
        ? { assignee, assignee_type: assignee.type ?? 'User' }
        : { assignee: null },
    });
    const needsYou = queueFolder('needs_you', key => key, 42).query.payload;

    it.each([
      ['drafted', 'unassigned', null],
      ['drafted', 'mine', { id: 42 }],
      ['handed_over', 'unassigned', null],
      ['handed_over', 'mine', { id: 42 }],
    ])('keeps an open %s conversation that is %s', (value, _, assignee) => {
      expect(
        matchesFilters(conversation('open', value, assignee), needsYou)
      ).toBe(true);
    });

    it.each([['drafted'], ['handed_over']])(
      'drops an open %s conversation assigned to a colleague',
      value => {
        expect(
          matchesFilters(conversation('open', value, { id: 7 }), needsYou)
        ).toBe(false);
      }
    );

    it('drops an open handed_over conversation assigned to a bot', () => {
      const bot = { id: 42, type: 'AgentBot' };
      expect(
        matchesFilters(conversation('open', 'handed_over', bot), needsYou)
      ).toBe(false);
    });

    it("keeps a colleague's drafted case in the account-wide Drafted queue", () => {
      const drafted = queueFolder('drafted', key => key, 42).query.payload;
      expect(
        matchesFilters(conversation('open', 'drafted', { id: 7 }), drafted)
      ).toBe(true);
    });

    it.each([['drafted'], ['handed_over']])(
      'keeps an open %s conversation in Needs you',
      value => {
        expect(matchesFilters(conversation('open', value), needsYou)).toBe(
          true
        );
      }
    );

    it.each([
      ['a resolved handed_over', 'resolved', 'handed_over'],
      ['a resolved drafted', 'resolved', 'drafted'],
      ['an open auto_holding', 'open', 'auto_holding'],
      ['an open sent', 'open', 'sent'],
      ['an open conversation the agent never touched', 'open', null],
    ])('drops %s conversation from Needs you', (_, status, value) => {
      expect(matchesFilters(conversation(status, value), needsYou)).toBe(false);
    });
  });
});

describe('queue tabs', () => {
  it('narrows Needs you to drafts or to hand-overs', () => {
    expect(filtersFor('needs_you', 'all')).toEqual(['drafted', 'handed_over']);
    expect(filtersFor('needs_you', 'drafts')).toEqual(['drafted']);
    expect(filtersFor('needs_you', 'handed_over')).toEqual(['handed_over']);
  });

  it('offers only the tabs that leave something to show', () => {
    expect(queueTabs('needs_you').map(tab => tab.key)).toEqual([
      'all',
      'drafts',
      'handed_over',
    ]);
    expect(queueTabs('drafted').map(tab => tab.key)).toEqual(['all', 'drafts']);
    expect(queueTabs('auto_holding').map(tab => tab.key)).toEqual(['all']);
  });

  it('builds a tab folder that never widens past its queue', () => {
    const folder = queueFolder('needs_you', key => key, 7, 'handed_over');
    const states = folder.query.payload
      .filter(row => row.attribute_key === 'gotchu_state')
      .map(row => row.values[0]);
    expect([...new Set(states)]).toEqual(['handed_over']);
    expect(
      queueFolder('drafted', key => key, 7, 'handed_over')
    ).toBeUndefined();
  });
});

// "Email, via Support Mail" under a store is that store's mail in the shared
// inbox, not the whole inbox: every store's copy used to open the same
// unfiltered list.
describe('store folders', () => {
  const conversation = (storeKey, inboxId) => ({
    status: 'open',
    inbox_id: inboxId,
    custom_attributes: { store_key: storeKey },
  });

  it('shows the store across every inbox', () => {
    const { payload } = storeFolder('cadeauniq').query;
    expect(matchesFilters(conversation('cadeauniq', 1), payload)).toBe(true);
    expect(matchesFilters(conversation('cadeauniq', 3), payload)).toBe(true);
    expect(matchesFilters(conversation('persoliebe', 1), payload)).toBe(false);
  });

  it('narrows to one inbox when the route names one', () => {
    const folder = storeFolder('cadeauniq-inbox-1');
    expect(folder.name).toBe('cadeauniq · #1');
    const { payload } = folder.query;
    expect(payload[payload.length - 1].query_operator).toBeNull();
    expect(matchesFilters(conversation('cadeauniq', 1), payload)).toBe(true);
    expect(matchesFilters(conversation('cadeauniq', 3), payload)).toBe(false);
    expect(matchesFilters(conversation('persoliebe', 1), payload)).toBe(false);
  });

  // The header read "persoliebe" for both the store and its shared mail, so
  // the two pages looked the same (staging sweep 2026-10-16).
  it('titles the queue with the store name, and the inbox when it names one', () => {
    const names = {
      stores: [{ key: 'cadeauniq', name: 'Cadeauniq' }],
      inboxes: [{ id: 1, name: 'Support Mailbox' }],
    };
    expect(storeFolder('cadeauniq', names).name).toBe('Cadeauniq');
    expect(storeFolder('cadeauniq-inbox-1', names).name).toBe(
      'Cadeauniq · Support Mailbox'
    );
    expect(storeFolder('cadeauniq-inbox-9', names).name).toBe('Cadeauniq · #9');
  });

  it('falls back to the key while the store list has not loaded', () => {
    expect(storeFolder('giftera').name).toBe('giftera');
  });
});

// ChatList refetches when its folder changes. A queue folder is rebuilt
// whenever the signed-in user object is replaced -- every 20s presence tick --
// and a refetch empties the list, which took the open conversation with it.
describe('sameFolder', () => {
  const t = key => key;

  it('treats a rebuilt folder with the same query as the same folder', () => {
    expect(
      sameFolder(queueFolder('needs_you', t, 7), queueFolder('needs_you', t, 7))
    ).toBe(true);
    expect(sameFolder(storeFolder('giftera'), storeFolder('giftera'))).toBe(
      true
    );
    expect(sameFolder(undefined, undefined)).toBe(true);
  });

  it('keeps a store queue the same folder when only its title arrives', () => {
    const named = storeFolder('giftera', {
      stores: [{ key: 'giftera', name: 'Giftera' }],
    });
    expect(sameFolder(storeFolder('giftera'), named)).toBe(true);
  });

  it('tells apart a different queue, user, tab, store or inbox', () => {
    const needsYou = queueFolder('needs_you', t, 7);
    expect(sameFolder(needsYou, queueFolder('needs_you', t, 8))).toBe(false);
    expect(sameFolder(needsYou, queueFolder('drafted', t, 7))).toBe(false);
    expect(
      sameFolder(needsYou, queueFolder('needs_you', t, 7, 'handed_over'))
    ).toBe(false);
    expect(sameFolder(storeFolder('giftera'), storeFolder('cadeauniq'))).toBe(
      false
    );
    expect(
      sameFolder(storeFolder('giftera'), storeFolder('giftera-inbox-1'))
    ).toBe(false);
    expect(sameFolder(needsYou, undefined)).toBe(false);
  });

  it('tells apart a saved folder whose name or query was edited', () => {
    const folder = { id: 3, name: 'VIP', query: { payload: [{ a: 1 }] } };
    expect(sameFolder(folder, { ...folder })).toBe(true);
    expect(sameFolder(folder, { ...folder, name: 'VIPs' })).toBe(false);
    expect(
      sameFolder(folder, { ...folder, query: { payload: [{ a: 2 }] } })
    ).toBe(false);
  });
});
