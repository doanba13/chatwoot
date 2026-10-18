import {
  resolveTranslateTarget,
  shouldAutoTranslate,
  claimAutoTranslate,
  releaseAutoTranslate,
  createTaskQueue,
} from '../useTranslateSetting';

describe('resolveTranslateTarget', () => {
  it('prefers a valid saved target', () => {
    expect(
      resolveTranslateTarget({
        saved: 'fr',
        uiLocale: 'vi',
        accountLocale: 'de',
      })
    ).toBe('fr');
  });

  it('uses the UI locale, then the account locale', () => {
    expect(
      resolveTranslateTarget({ uiLocale: 'vi', accountLocale: 'de' })
    ).toBe('vi');
    expect(
      resolveTranslateTarget({ uiLocale: 'es', accountLocale: 'de' })
    ).toBe('de');
  });

  it('falls back to en, ignoring unsupported values', () => {
    expect(
      resolveTranslateTarget({ uiLocale: 'pt_BR', accountLocale: 'ja' })
    ).toBe('en');
    expect(resolveTranslateTarget({ saved: 'zz' })).toBe('en');
    expect(resolveTranslateTarget({})).toBe('en');
  });

  it('matches a regional locale by its base', () => {
    expect(resolveTranslateTarget({ uiLocale: 'de_AT' })).toBe('de');
  });
});

describe('shouldAutoTranslate', () => {
  const on = { enabled: true, target: 'de', translations: {} };
  const message = { content: 'Hi', messageType: 0, private: false };

  it('requests for a plain message when switched on', () => {
    expect(shouldAutoTranslate(message, on)).toBe(true);
  });

  it('does nothing when switched off', () => {
    expect(shouldAutoTranslate(message, { ...on, enabled: false })).toBe(false);
  });

  it('does not request for a private note', () => {
    expect(shouldAutoTranslate({ ...message, private: true }, on)).toBe(false);
  });

  it('does not request for activity or template messages', () => {
    expect(shouldAutoTranslate({ ...message, messageType: 2 }, on)).toBe(false);
    expect(shouldAutoTranslate({ ...message, messageType: 3 }, on)).toBe(false);
  });

  it('does not request for empty content', () => {
    expect(shouldAutoTranslate({ ...message, content: '  ' }, on)).toBe(false);
    expect(shouldAutoTranslate({ ...message, content: null }, on)).toBe(false);
  });

  it('does not request when the target is already stored', () => {
    expect(
      shouldAutoTranslate(message, { ...on, translations: { de: 'Hallo' } })
    ).toBe(false);
  });

  it('still requests when only another language is stored', () => {
    expect(
      shouldAutoTranslate(message, { ...on, translations: { fr: 'Salut' } })
    ).toBe(true);
  });
});

describe('claimAutoTranslate', () => {
  it('lets one request through per message and target', () => {
    expect(claimAutoTranslate(901, 'de')).toBe(true);
    expect(claimAutoTranslate(901, 'de')).toBe(false);
    expect(claimAutoTranslate(901, 'fr')).toBe(true);
  });
});

describe('releaseAutoTranslate', () => {
  it('lets a released claim be taken again, for that language only', () => {
    expect(claimAutoTranslate(902, 'de')).toBe(true);
    expect(claimAutoTranslate(902, 'fr')).toBe(true);
    releaseAutoTranslate(902, 'de');
    expect(claimAutoTranslate(902, 'de')).toBe(true);
    expect(claimAutoTranslate(902, 'fr')).toBe(false);
  });
});

describe('createTaskQueue', () => {
  it('never runs more than the limit at once and completes every task', async () => {
    const enqueue = createTaskQueue(3);
    let active = 0;
    let peak = 0;
    const order = [];
    const make = i => async () => {
      active += 1;
      peak = Math.max(peak, active);
      order.push(i);
      await new Promise(r => {
        setTimeout(r, 2);
      });
      active -= 1;
      return i;
    };
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => enqueue(make(i)))
    );
    expect(peak).toBe(3);
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('keeps going after a rejection', async () => {
    const enqueue = createTaskQueue(1);
    const bad = enqueue(() => Promise.reject(new Error('boom')));
    const good = enqueue(() => Promise.resolve('ok'));
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
  });

  it('survives a task that throws synchronously', async () => {
    const enqueue = createTaskQueue(1);
    const bad = enqueue(() => {
      throw new Error('sync');
    });
    const good = enqueue(() => 'ok');
    await expect(bad).rejects.toThrow('sync');
    await expect(good).resolves.toBe('ok');
  });
});
