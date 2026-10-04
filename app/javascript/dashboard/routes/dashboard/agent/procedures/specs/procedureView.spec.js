import { tierFor, tierOptions } from '../procedureView';

const proc = (over = {}) => ({
  status: 'active',
  channels: {
    email: { autoPossible: true },
    messenger: { autoPossible: false, reason: 'order_unverifiable' },
    web: { autoPossible: false, reason: 'order_unverifiable' },
  },
  autoSendEnabled: true,
  ...over,
});

describe('tierFor', () => {
  it('reads Off for a channel with no binding row: the procedure never matches there', () => {
    expect(tierFor([], 'web')).toBe('off');
  });
  it('reads the stored tier of a testing procedure too, not Off', () => {
    expect(tierFor([{ channel: 'email', tier: 'draft' }], 'email')).toBe(
      'draft'
    );
  });
  it('reads the bound tier otherwise', () => {
    expect(tierFor([{ channel: 'web', tier: 'hand_over' }], 'web')).toBe(
      'hand_over'
    );
  });
});

describe('tierOptions', () => {
  it('disables Auto on a channel that cannot prove whose order it is, with that reason', () => {
    const auto = tierOptions(proc(), 'messenger').find(o => o.value === 'auto');
    expect(auto).toEqual({
      value: 'auto',
      disabled: true,
      reasonKey: 'GOTCHU_AGENT.PROCEDURE.AUTO_OFF_UNVERIFIABLE',
    });
  });
  it('disables Auto when the store is not switched on for sending', () => {
    const auto = tierOptions(proc({ autoSendEnabled: false }), 'email').find(
      o => o.value === 'auto'
    );
    expect(auto.reasonKey).toBe('GOTCHU_AGENT.PROCEDURE.AUTO_OFF_STORE');
  });
  it('disables Auto on a procedure that is not active', () => {
    const auto = tierOptions(proc({ status: 'testing' }), 'email').find(
      o => o.value === 'auto'
    );
    expect(auto.reasonKey).toBe('GOTCHU_AGENT.PROCEDURE.AUTO_OFF_NOT_ACTIVE');
  });
  it('leaves Off, Hand over and Draft open', () => {
    expect(
      tierOptions(proc(), 'messenger')
        .filter(o => o.disabled)
        .map(o => o.value)
    ).toEqual(['auto']);
  });
});
