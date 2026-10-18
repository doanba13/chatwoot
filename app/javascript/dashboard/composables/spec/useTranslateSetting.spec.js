import {
  resolveTranslateTarget,
  shouldAutoTranslate,
  claimAutoTranslate,
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
