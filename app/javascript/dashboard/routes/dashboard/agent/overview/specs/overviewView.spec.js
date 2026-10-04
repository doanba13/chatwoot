import { statusSentence, share, secondsLeft, holdLeft } from '../overviewView';

const proc = (tiers, status = 'active') => ({ status, tiers });

describe('overviewView', () => {
  it('renders null as a dash, never 0%', () => {
    expect(share(null)).toBe('—');
    expect(share(0.71)).toBe('71%');
  });

  it('says how many procedures send on their own, and where', () => {
    const o = {
      storeCount: 4,
      procedures: [
        proc({ email: 'auto', messenger: 'draft', web: 'draft' }),
        proc({ email: 'draft', messenger: 'draft', web: 'draft' }),
      ],
    };
    expect(statusSentence(o)).toEqual({
      key: 'GOTCHU_AGENT.OVERVIEW.STATUS_SOME_AUTO',
      params: { stores: 4, n: 1, channels: 'email' },
    });
  });

  it('says everything waits for a person when nothing is on auto', () => {
    const o = {
      storeCount: 4,
      procedures: [proc({ email: 'draft', messenger: 'draft', web: 'draft' })],
    };
    expect(statusSentence(o).key).toBe('GOTCHU_AGENT.OVERVIEW.STATUS_NO_AUTO');
  });

  it('ignores a testing procedure’s bindings', () => {
    const o = {
      storeCount: 4,
      procedures: [proc({ email: 'auto' }, 'testing')],
    };
    expect(statusSentence(o).key).toBe('GOTCHU_AGENT.OVERVIEW.STATUS_NO_AUTO');
  });

  // Whole minutes from a minute up, rounded down so the card never promises
  // more time than is left; seconds under a minute.
  it.each([
    [3395, 'GOTCHU_AGENT.OVERVIEW.HOLDING_MINUTES', 56],
    [119, 'GOTCHU_AGENT.OVERVIEW.HOLDING_MINUTES', 1],
    [60, 'GOTCHU_AGENT.OVERVIEW.HOLDING_MINUTES', 1],
    [59, 'GOTCHU_AGENT.OVERVIEW.HOLDING_SECONDS', 59],
    [1, 'GOTCHU_AGENT.OVERVIEW.HOLDING_SECONDS', 1],
  ])('words a hold of %s s as %s %s', (seconds, key, n) => {
    expect(holdLeft(seconds)).toEqual({ key, params: { n } });
  });

  it('counts down to the release and never below zero', () => {
    const now = new Date('2026-10-04T10:00:00Z');
    expect(secondsLeft('2026-10-04T10:00:38Z', now)).toBe(38);
    expect(secondsLeft('2026-10-04T09:59:00Z', now)).toBe(0);
  });
});
