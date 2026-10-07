// The app's locale codes are Rails-style ('pt_BR', 'zh_CN'); Intl wants BCP 47
// ('pt-BR') and throws a RangeError on the underscore. Every Intl.*Format the
// Gotchu screens build takes its locale through here.
export const toBcp47 = locale =>
  String(locale || '').replace(/_/g, '-') || undefined;

// The draft's language, worded. One literal key each, so the i18n linter can
// see them.
const LANG_WORDS = {
  de: t => t('GOTCHU.TRACE.LANG.DE'),
  fr: t => t('GOTCHU.TRACE.LANG.FR'),
  en: t => t('GOTCHU.TRACE.LANG.EN'),
};

export const languageWord = (lang, t) =>
  LANG_WORDS[String(lang ?? '').toLowerCase()]?.(t) ?? null;
