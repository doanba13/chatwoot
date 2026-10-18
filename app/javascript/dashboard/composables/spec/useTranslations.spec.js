import { selectTranslation } from '../useTranslations';

describe('selectTranslation', () => {
  it('returns null when translations is null', () => {
    expect(selectTranslation(null, 'en')).toBeNull();
  });

  it('returns null when translations is empty', () => {
    expect(selectTranslation({}, 'en')).toBeNull();
  });

  it('returns the translation for the target', () => {
    expect(selectTranslation({ en: 'Hello', de: 'Hallo' }, 'de')).toBe('Hallo');
  });

  it('never falls back to another stored language', () => {
    expect(selectTranslation({ de: 'Hallo' }, 'vi')).toBeNull();
  });

  it('returns null without a target', () => {
    expect(selectTranslation({ en: 'Hello' }, undefined)).toBeNull();
  });
});
