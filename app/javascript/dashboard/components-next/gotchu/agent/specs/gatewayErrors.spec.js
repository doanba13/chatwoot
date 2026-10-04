import { gatewayErrorKey } from '../gatewayErrors';

const err = (status, reason) =>
  Object.assign(new Error('x'), { response: { status, data: { reason } } });

describe('gatewayErrorKey', () => {
  it.each([
    [409, 'stale_version', 'GOTCHU_AGENT.ERRORS.CHANGED'],
    [409, 'rule_changed', 'GOTCHU_AGENT.ERRORS.CHANGED'],
    [409, 'memo_changed', 'GOTCHU_AGENT.ERRORS.CHANGED'],
    [404, 'not_found', 'GOTCHU_AGENT.ERRORS.NOT_FOUND'],
    [422, 'invalid', 'GOTCHU_AGENT.ERRORS.INVALID'],
    [401, undefined, 'GOTCHU_AGENT.ERRORS.FORBIDDEN'],
    [503, 'unconfigured', 'GOTCHU_AGENT.ERRORS.UNCONFIGURED'],
    [502, 'unavailable', 'GOTCHU_AGENT.ERRORS.UNAVAILABLE'],
  ])('maps %i %s', (status, reason, key) => {
    expect(gatewayErrorKey(err(status, reason))).toBe(key);
  });
  it('maps a network failure to unavailable', () => {
    expect(gatewayErrorKey(new Error('Network Error'))).toBe(
      'GOTCHU_AGENT.ERRORS.UNAVAILABLE'
    );
  });
});
