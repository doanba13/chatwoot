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
});
