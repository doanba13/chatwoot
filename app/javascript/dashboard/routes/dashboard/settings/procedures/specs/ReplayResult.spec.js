import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ReplayResult from '../ReplayResult.vue';

// The real catalogue, not `t: key => key`: the headline is a vue-i18n
// plural, and the whole point of this component is the exact number it
// renders, so a key-returning mock would assert nothing about it.
withFullI18n();

const mountComponent = (result, procedureId = 2) =>
  mount(ReplayResult, { props: { result, procedureId } });

const headlineOf = wrapper =>
  wrapper.find('[data-testid="replay-match-count"]').text();

describe('ReplayResult', () => {
  // This is the exact bug the fix round found: byResolution.matched is a
  // total across every active/testing procedure, not the one row a merchant
  // pressed Replay on. This test fails against a component that reads
  // byResolution instead of byProcedure -- it would render "10", not "3".
  it("headlines the row's own count from byProcedure, not byResolution's total across every procedure", () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: false,
      byResolution: { matched: 10, below_floor: 2 },
      byProcedure: [
        { procedureId: 1, slug: 'other', title: 'Other', count: 7 },
        { procedureId: 2, slug: 'this-one', title: 'This one', count: 3 },
      ],
    };

    expect(headlineOf(mountComponent(result, 2))).toBe(
      '3 conversations would have matched this procedure.'
    );
  });

  it('headlines a singular count correctly', () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: false,
      byProcedure: [{ procedureId: 2, slug: 'x', title: 'X', count: 1 }],
    };

    expect(headlineOf(mountComponent(result, 2))).toBe(
      '1 conversation would have matched this procedure.'
    );
  });

  it('headlines zero when this procedure has no entry in byProcedure', () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: false,
      byResolution: { matched: 10 },
      byProcedure: [
        { procedureId: 1, slug: 'other', title: 'Other', count: 10 },
      ],
    };

    expect(headlineOf(mountComponent(result, 2))).toContain('0 conversation');
  });

  it('states the scan window honestly, capped by count rather than by day range', () => {
    const result = {
      days: 30,
      considered: 200,
      cappedByWindow: true,
      timedOut: false,
      byProcedure: [{ procedureId: 2, slug: 'x', title: 'X', count: 5 }],
    };

    const text = mountComponent(result, 2).text();
    expect(text).toContain('more exist in the window than this scan covers');
    // Never claims the 30-day window when the scan was actually capped by
    // conversation count -- replayScopeView's own honesty rule.
    expect(text).not.toContain('last 30 days');
  });

  it('states the uncapped scan window by its day range', () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: false,
      byProcedure: [{ procedureId: 2, slug: 'x', title: 'X', count: 5 }],
    };

    expect(mountComponent(result, 2).text()).toContain(
      'Scanned the last 30 days (50 conversations).'
    );
  });

  it('shows the timed-out warning when the scan did not finish', () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: true,
      byProcedure: [{ procedureId: 2, slug: 'x', title: 'X', count: 5 }],
    };

    expect(mountComponent(result, 2).text()).toContain(
      'The scan did not finish in time'
    );
  });

  it('shows no timed-out warning when the scan finished', () => {
    const result = {
      days: 30,
      considered: 50,
      cappedByWindow: false,
      timedOut: false,
      byProcedure: [{ procedureId: 2, slug: 'x', title: 'X', count: 5 }],
    };

    expect(mountComponent(result, 2).text()).not.toContain(
      'did not finish in time'
    );
  });
});
