import { queueChip } from './queueChip';

const t = key => key;

describe('queueChip', () => {
  it.each([
    ['drafted', 'CONVERSATION.GOTCHU_QUEUE.DRAFTED', true],
    ['auto_holding', 'CONVERSATION.GOTCHU_QUEUE.AUTO_HOLDING', true],
    ['handed_over', 'CONVERSATION.GOTCHU_QUEUE.HANDED_OVER', false],
    ['sent', 'CONVERSATION.GOTCHU_QUEUE.SENT', false],
  ])('labels %s', (state, label, agent) => {
    expect(queueChip({ gotchu_state: state }, t)).toEqual({
      label,
      procedure: null,
      reason: null,
      agent,
    });
  });

  it('carries the procedure title beside the label', () => {
    expect(
      queueChip(
        { gotchu_state: 'drafted', gotchu_procedure: 'Where is my order' },
        t
      ).procedure
    ).toBe('Where is my order');
  });

  it.each([
    [undefined],
    [{}],
    [{ gotchu_state: 'something_else' }],
    [{ gotchu_state: 42 }],
  ])('shows nothing for %j', attrs => expect(queueChip(attrs, t)).toBeNull());

  it('shows a procedure only when it is a short string', () => {
    expect(
      queueChip({ gotchu_state: 'drafted', gotchu_procedure: { x: 1 } }, t)
        .procedure
    ).toBeNull();
    expect(
      queueChip(
        { gotchu_state: 'drafted', gotchu_procedure: 'x'.repeat(200) },
        t
      ).procedure
    ).toHaveLength(100);
  });

  it('carries the rule that handed the case over, checked like the procedure', () => {
    expect(
      queueChip(
        {
          gotchu_state: 'handed_over',
          gotchu_reason: 'Late parcels',
          gotchu_procedure: 'Where is my order',
        },
        t
      )
    ).toMatchObject({ reason: 'Late parcels', procedure: 'Where is my order' });
  });

  it.each([[42], [''], [{ a: 1 }]])(
    'drops a reason that is not a non-empty string: %j',
    bad => {
      expect(
        queueChip({ gotchu_state: 'handed_over', gotchu_reason: bad }, t).reason
      ).toBeNull();
    }
  );

  it('cuts a long reason to 100 characters, as it does a procedure', () => {
    expect(
      queueChip(
        { gotchu_state: 'handed_over', gotchu_reason: 'x'.repeat(300) },
        t
      ).reason
    ).toHaveLength(100);
  });

  it('has no reason on any state but a hand-over', () => {
    expect(
      queueChip({ gotchu_state: 'drafted', gotchu_reason: 'Late parcels' }, t)
        .reason
    ).toBeNull();
  });
});
