import { QUEUES, queueFolder } from './queues';
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

describe('queueFolder', () => {
  it('builds Needs you as open conversations the agent drafted or handed over', () => {
    expect(queueFolder('needs_you', key => key).query.payload).toEqual([
      open,
      state('drafted', 'or'),
      open,
      state('handed_over', null),
    ]);
  });

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
    const conversation = (status, gotchuState) => ({
      id: 1,
      status,
      custom_attributes: gotchuState ? { gotchu_state: gotchuState } : {},
    });
    const needsYou = queueFolder('needs_you', key => key).query.payload;

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
