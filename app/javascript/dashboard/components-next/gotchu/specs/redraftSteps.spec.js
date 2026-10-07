import { redraftSteps } from '../helpers/redraftSteps';

const states = r => r.map(s => `${s.key}:${s.state}`);

describe('redraftSteps', () => {
  it('starts with the instruction received and the re-read under way', () => {
    expect(
      states(
        redraftSteps({ elapsedMs: 0, orderName: 'PL-5713', nextVersion: 2 })
      )
    ).toEqual(['received:done', 'reread:now', 'writing:todo']);
  });

  it('moves to writing the next version after two seconds', () => {
    const steps = redraftSteps({
      elapsedMs: 2500,
      orderName: 'PL-5713',
      nextVersion: 2,
    });
    expect(states(steps)).toEqual([
      'received:done',
      'reread:done',
      'writing:now',
    ]);
    expect(steps[2].params).toEqual({ version: 2 });
  });

  it('never marks writing done by itself, however long it takes', () => {
    expect(
      states(
        redraftSteps({ elapsedMs: 170000, orderName: null, nextVersion: 3 })
      ).at(-1)
    ).toBe('writing:now');
  });

  it('names the order when there is one, and only then', () => {
    expect(
      redraftSteps({ elapsedMs: 0, orderName: 'PL-5713', nextVersion: 2 })[1]
    ).toMatchObject({
      params: { order: 'PL-5713' },
      label: 'STEP_REREAD_ORDER',
    });
    expect(
      redraftSteps({ elapsedMs: 0, orderName: null, nextVersion: 2 })[1]
    ).toMatchObject({ label: 'STEP_REREAD' });
  });
});
