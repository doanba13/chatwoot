import { computed } from 'vue';
import { useUISettings } from './useUISettings';
import { useAccount } from './useAccount';

export const TRANSLATE_TARGETS = Object.freeze(['en', 'vi', 'de', 'fr']);

const UNTRANSLATED_TYPES = new Set([2, 3]); // activity, template

const isTarget = lang => TRANSLATE_TARGETS.includes(lang);
const baseOf = locale => (locale ? String(locale).split(/[_-]/)[0] : null);

/**
 * The saved target if valid, else the first of the UI and account locales
 * whose base language is a supported target, else English.
 */
export function resolveTranslateTarget({
  saved,
  uiLocale,
  accountLocale,
} = {}) {
  if (isTarget(saved)) return saved;
  const fromLocale = [uiLocale, accountLocale].map(baseOf).find(isTarget);
  return fromLocale || 'en';
}

/**
 * Whether a message should be sent for translation on its own. Pure so it
 * can be tested without mounting; `message` is the camelCased message.
 */
export function shouldAutoTranslate(
  message,
  { enabled, target, translations }
) {
  if (!enabled || !isTarget(target)) return false;
  if (!message || message.private) return false;
  if (UNTRANSLATED_TYPES.has(message.messageType)) return false;
  if (!message.content || !String(message.content).trim()) return false;
  return !translations?.[target];
}

const claimed = new Set();

/**
 * True the first time a message is claimed for a target. A text already in
 * the target language stores nothing, so without this it would be asked for
 * again each time its bubble mounts.
 */
export function claimAutoTranslate(messageId, target) {
  const key = `${messageId}:${target}`;
  if (claimed.has(key)) return false;
  claimed.add(key);
  return true;
}

export function useTranslateSetting() {
  const { uiSettings, updateUISettings } = useUISettings();
  const { currentAccount } = useAccount();

  const enabled = computed(() => !!uiSettings.value?.gotchu_translate_on);
  const target = computed(() =>
    resolveTranslateTarget({
      saved: uiSettings.value?.gotchu_translate_target,
      uiLocale: uiSettings.value?.locale,
      accountLocale: currentAccount.value?.locale,
    })
  );

  const setEnabled = value =>
    updateUISettings({ gotchu_translate_on: !!value });
  const setTarget = lang => {
    if (isTarget(lang)) updateUISettings({ gotchu_translate_target: lang });
  };

  return { enabled, target, setEnabled, setTarget };
}
