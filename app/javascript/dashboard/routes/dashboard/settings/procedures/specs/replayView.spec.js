import { replayScopeView, replayIsPartial } from '../replayView';

describe('#replayScopeView', () => {
  it('describes an uncapped scan by its day window', () => {
    expect(
      replayScopeView({ days: 30, considered: 42, cappedByWindow: false })
    ).toEqual({
      key: 'PROCEDURES_MGMT.REPLAY.SCOPE',
      params: { days: 30, considered: 42 },
    });
  });

  it('describes a capped scan by its count, not the day window', () => {
    expect(
      replayScopeView({ days: 30, considered: 200, cappedByWindow: true })
    ).toEqual({
      key: 'PROCEDURES_MGMT.REPLAY.SCOPE_CAPPED',
      params: { considered: 200 },
    });
  });

  it('never claims the day window when the window was capped by count', () => {
    const view = replayScopeView({
      days: 90,
      considered: 200,
      cappedByWindow: true,
    });
    expect(view.params.days).toBeUndefined();
  });
});

describe('#replayIsPartial', () => {
  it('is true only when the gateway reports a timeout', () => {
    expect(replayIsPartial({ timedOut: true })).toEqual(true);
  });

  it('is false when the scan finished', () => {
    expect(replayIsPartial({ timedOut: false })).toEqual(false);
  });

  it('is false on a missing flag, not true by default', () => {
    expect(replayIsPartial({})).toEqual(false);
    expect(replayIsPartial(undefined)).toEqual(false);
  });

  it('never reports a finished scan as partial just because it was also capped', () => {
    expect(replayIsPartial({ timedOut: false, cappedByWindow: true })).toEqual(
      false
    );
  });
});
