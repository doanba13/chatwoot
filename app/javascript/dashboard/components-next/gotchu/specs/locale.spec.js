import { withFullI18n } from 'test-i18n';
import { toBcp47, languageWord } from '../helpers/locale';
import { dayLabel } from '../thread/threadWords';
import { drawerView } from '../drawer/drawerView';
import { persoliebe } from '../drawer/specs/fixtures';

const { t, te } = withFullI18n().global;

describe('toBcp47', () => {
  it('turns the app locale codes into tags Intl accepts', () => {
    expect(toBcp47('pt_BR')).toBe('pt-BR');
    expect(toBcp47('zh_CN')).toBe('zh-CN');
    expect(toBcp47('de')).toBe('de');
    expect(toBcp47('')).toBeUndefined();
    expect(toBcp47(null)).toBeUndefined();
  });

  it.each(['pt_BR', 'zh_CN'])('keeps a %s day label from throwing', locale => {
    const now = new Date(2026, 9, 6, 9, 0);
    expect(() => new Intl.DateTimeFormat(locale)).toThrow(RangeError);
    expect(dayLabel(new Date(2026, 9, 1, 9, 0), now, t, locale)).toEqual(
      expect.any(String)
    );
  });

  it.each(['pt_BR', 'zh_CN'])('keeps a %s drawer from throwing', locale => {
    const now = Date.parse('2026-10-06T10:06:00Z');
    expect(() =>
      drawerView(persoliebe, { t, te, lang: 'de', locale, now })
    ).not.toThrow();
  });
});

describe('languageWord', () => {
  it('words a known language in any case and nothing else', () => {
    expect(languageWord('DE', t)).toBe(t('GOTCHU.TRACE.LANG.DE'));
    expect(languageWord('it', t)).toBeNull();
    expect(languageWord(null, t)).toBeNull();
  });
});
