import { computed } from 'vue';
import { useTranslateSetting } from './useTranslateSetting';

/**
 * Select the stored translation for exactly one target language.
 * Never falls back to another language: a German text shown to someone who
 * asked for Vietnamese would be wrong without saying so.
 * @param {Object} translations - Translations object with language keys
 * @param {string} target - The wanted language
 * @returns {string|null} The translation or null
 */
export function selectTranslation(translations, target) {
  if (!translations || !target) return null;
  return translations[target] || null;
}

/**
 * Composable to extract translation state/content from contentAttributes.
 * @param {Ref|Reactive} contentAttributes - Ref or reactive object containing `translations` property
 * @returns {Object} { hasTranslations, translationContent, isPartial, showToggle }
 */
export function useTranslations(contentAttributes) {
  const { enabled, target } = useTranslateSetting();

  const translationContent = computed(() =>
    selectTranslation(contentAttributes.value?.translations, target.value)
  );
  const hasTranslations = computed(() => !!translationContent.value);

  // translation_partial arrives camelCased unless the caller kept it raw.
  const isPartial = computed(() => {
    const attrs = contentAttributes.value || {};
    const partial = attrs.translationPartial || attrs.translation_partial;
    return hasTranslations.value && (partial || []).includes(target.value);
  });

  // While the switch is on the translation is the view; the original toggle
  // stays only when the switch is off or the translation is cut short.
  const showToggle = computed(
    () => hasTranslations.value && (!enabled.value || isPartial.value)
  );

  return { hasTranslations, translationContent, isPartial, showToggle };
}
