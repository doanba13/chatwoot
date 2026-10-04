import { QUEUES, queueFolder, filtersFor, queueTabs } from './queues';
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
