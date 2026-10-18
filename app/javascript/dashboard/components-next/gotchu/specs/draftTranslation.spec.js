import { pickDraftText } from '../helpers/draftTranslation';

describe('pickDraftText', () => {
  const draft = { version: 3, body: 'B3' };

  it('ignores a translation for a superseded version', () => {
    expect(
      pickDraftText({
        draft,
        translation: { version: 2, text: 'T2' },
        enabled: true,
      })
    ).toEqual({ text: 'B3', translated: false });
  });

  it('shows the original while switched off', () => {
    expect(
      pickDraftText({
        draft,
        translation: { version: 3, text: 'T3' },
        enabled: false,
      })
    ).toEqual({ text: 'B3', translated: false });
  });

  it('shows the translation for the current version', () => {
    expect(
      pickDraftText({
        draft,
        translation: { version: 3, text: 'T3' },
        enabled: true,
      })
    ).toEqual({ text: 'T3', translated: true });
  });

  it('shows the original when there is no translation or it is empty', () => {
    expect(
      pickDraftText({ draft, translation: null, enabled: true }).text
    ).toBe('B3');
    expect(
      pickDraftText({
        draft,
        translation: { version: 3, text: '' },
        enabled: true,
      }).translated
    ).toBe(false);
  });
});
