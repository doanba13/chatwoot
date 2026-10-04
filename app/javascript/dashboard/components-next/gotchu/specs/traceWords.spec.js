import { wordStep } from '../traceWords';
import { withFullI18n } from 'test-i18n';

// The real catalogue, so the sentences asserted are the ones a supporter
// reads. withFullI18n returns the i18n instance; useI18n would throw here,
// outside a component's setup.
const { t, te } = withFullI18n().global;

describe('wordStep', () => {
  it('words the procedure with its version and match score', () => {
    expect(
      wordStep(
        {
          kind: 'procedure',
          title: 'Where is my order',
          version: 4,
          score: 0.71,
          runnerUp: 0.52,
        },
        t,
        te
      )
    ).toEqual({
      kind: 'procedure',
      did: 'Procedure Where is my order v4',
      result: 'match 0.71, next best 0.52',
    });
  });
  // The gateway sends raw cosine scores; board 1 shows two decimals, and a
  // runner-up that is absent or no different from the score is no runner-up.
  it.each([
    [0.8887976514749183, 0.5212345, 'match 0.89, next best 0.52'],
    [0.8887976514749183, 0.8887976514749183, 'match 0.89'],
    [0.8887976514749183, null, 'match 0.89'],
  ])('rounds a match of %s against %s', (score, runnerUp, result) => {
    expect(
      wordStep(
        { kind: 'procedure', title: 'W', version: 1, score, runnerUp },
        t,
        te
      ).result
    ).toBe(result);
  });
  it('still words an old procedure step with a title only, with the existing sentence', () => {
    expect(wordStep({ kind: 'procedure', title: 'X' }, t, te).did).toBe(
      'Followed "X"'
    );
  });
  it('shows memo text when the step carries it, and the count when it does not', () => {
    expect(
      wordStep(
        {
          kind: 'memo',
          count: 1,
          memos: [
            { id: 12, excerpt: 'Engraved items ship 3 working days later…' },
          ],
        },
        t,
        te
      ).result
    ).toBe('“Engraved items ship 3 working days later…”');
    expect(wordStep({ kind: 'memo', count: 0 }, t, te).did).toBe('Memos none');
  });
  it('names a rule that held sending', () => {
    expect(
      wordStep(
        {
          kind: 'rule',
          rules: [
            {
              id: 1,
              version: 2,
              title: 'Engraved items',
              outcome: 'applied',
              effect: 'never_auto',
              missing: [],
            },
          ],
        },
        t,
        te
      )
    ).toEqual({
      kind: 'rule',
      did: 'Rules 1 applied',
      result: 'Engraved items · holds sending',
    });
  });
  it('says which fact was missing, and that a rule with a sending effect still holds', () => {
    expect(
      wordStep(
        {
          kind: 'rule',
          rules: [
            {
              id: 1,
              version: 1,
              title: 'Late parcels',
              outcome: 'skipped',
              effect: 'never_auto',
              missing: ['has_tracking'],
            },
          ],
        },
        t,
        te
      ).result
    ).toBe(
      'Late parcels · could not check “Has tracking”, so it holds sending'
    );
  });
  it('never says a text-only rule holds sending when its fact was missing', () => {
    expect(
      wordStep(
        {
          kind: 'rule',
          rules: [
            {
              id: 2,
              version: 1,
              title: 'Gift wrap',
              outcome: 'skipped',
              effect: 'none',
              missing: ['order_tag'],
            },
          ],
        },
        t,
        te
      ).result
    ).toBe('Gift wrap · could not check “Order tag”, so its text was left out');
  });
  it.each([
    [
      { reason: 'render_cap', missing: [], effect: 'none' },
      'not shown: too many rules matched',
    ],
    [
      { reason: 'render_cap', missing: [], effect: 'never_auto' },
      'not shown: too many rules matched; it still holds sending',
    ],
    [
      { reason: 'unreadable', missing: [], effect: 'none' },
      'could not be read by this version',
    ],
    [
      { reason: 'unreadable', missing: [], effect: 'hand_over' },
      'could not be read by this version; it still holds sending',
    ],
    [{ reason: null, missing: ['inbox'], effect: 'none' }, 'inbox unknown'],
    [
      { reason: null, missing: ['inbox'], effect: 'never_auto' },
      'inbox unknown; it still holds sending',
    ],
  ])(
    'says why a skipped rule was not shown, and keeps its hold: %j',
    (row, phrase) => {
      expect(
        wordStep(
          {
            kind: 'rule',
            rules: [
              {
                id: 3,
                version: 1,
                title: 'Bulk orders',
                outcome: 'skipped',
                ...row,
              },
            ],
          },
          t,
          te
        ).result
      ).toBe(`Bulk orders · ${phrase}`);
    }
  );
  it('words the tier from the tier', () => {
    expect(
      wordStep(
        { kind: 'tier', tier: 'draft', channel: 'email', refusal: null },
        t,
        te
      )
    ).toEqual({
      kind: 'tier',
      did: 'Tier draft on email',
      result: 'waits for a person',
    });
  });
  it('never reads refusal null on an auto tier as a send', () => {
    const { result } = wordStep(
      { kind: 'tier', tier: 'auto', channel: 'email', refusal: null },
      t,
      te
    );
    expect(result).toBe(
      'may send on its own; that is decided when the hold ends, not here'
    );
    expect(result).not.toMatch(/^sends on its own/);
  });
  it('says a rule held an auto tier back', () => {
    expect(
      wordStep(
        { kind: 'tier', tier: 'auto', channel: 'email', refusal: 'rule_hold' },
        t,
        te
      ).result
    ).toBe('a rule holds sending, so it waits for a person');
  });
  it('words a hand-over tier, never as unknown', () => {
    expect(
      wordStep(
        {
          kind: 'tier',
          tier: 'hand_over',
          channel: 'web',
          refusal: 'handover_tier',
        },
        t,
        te
      )
    ).toEqual({
      kind: 'tier',
      did: 'Tier hand over on web',
      result: 'the procedure hands this over to a person',
    });
  });
  it('says when no procedure matched, so there was no tier', () => {
    expect(
      wordStep(
        { kind: 'tier', tier: null, channel: 'web', refusal: null },
        t,
        te
      )
    ).toEqual({
      kind: 'tier',
      did: 'No procedure matched',
      result: 'waits for a person',
    });
  });
  it('says the channel was unknown, never that no procedure matched', () => {
    expect(
      wordStep(
        { kind: 'tier', tier: null, channel: null, refusal: null },
        t,
        te
      )
    ).toEqual({
      kind: 'tier',
      did: 'No tier: channel unknown',
      result: 'waits for a person',
    });
  });
  it('drops a kind this build does not know', () => {
    expect(wordStep({ kind: 'future_thing' }, t, te)).toBeNull();
  });
});
