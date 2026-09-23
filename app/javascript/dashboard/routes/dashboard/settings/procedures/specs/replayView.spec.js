import {
  replayScopeView,
  replayIsPartial,
  replayMatchCount,
} from '../replayView';

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

describe('#replayMatchCount', () => {
  // The exact shape of the bug this guards: byResolution.matched is a total
  // over EVERY active/testing procedure, not the one a merchant pressed
  // Replay on. A procedure with a small share of that total must read its
  // own count, never the whole set's.
  it("reads the row's own count from byProcedure, never byResolution's total across every procedure", () => {
    const result = {
      byResolution: { matched: 10, below_floor: 2 },
      byProcedure: [
        { procedureId: 1, slug: 'other', title: 'Other', count: 7 },
        { procedureId: 2, slug: 'this-one', title: 'This one', count: 3 },
      ],
    };

    expect(replayMatchCount(result, 2)).toEqual(3);
  });

  it('is zero when this procedure has no entry in byProcedure, not the whole-set total', () => {
    const result = {
      byResolution: { matched: 10 },
      byProcedure: [
        { procedureId: 1, slug: 'other', title: 'Other', count: 10 },
      ],
    };

    expect(replayMatchCount(result, 2)).toEqual(0);
  });

  it('is zero on a missing or empty byProcedure', () => {
    expect(replayMatchCount({ byResolution: { matched: 5 } }, 2)).toEqual(0);
    expect(replayMatchCount({ byProcedure: [] }, 2)).toEqual(0);
    expect(replayMatchCount(undefined, 2)).toEqual(0);
  });
});
