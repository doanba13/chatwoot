import { channelWord } from '../thread/threadWords';

const INBOX_CHANNELS = {
  'Channel::Email': 'email',
  'Channel::FacebookPage': 'messenger',
  'Channel::WebWidget': 'web',
};

// One literal key each, so the i18n linter can see them.
const LANG_WORDS = {
  de: t => t('GOTCHU.TRACE.LANG.DE'),
  fr: t => t('GOTCHU.TRACE.LANG.FR'),
  en: t => t('GOTCHU.TRACE.LANG.EN'),
};

// The gateway's channel when it said one (even 'other', which names nothing);
// the inbox only when it said nothing at all, i.e. no read yet or an old gateway.
const channelFor = (draftMeta, inboxChannelType, t) => {
  const fromGateway = draftMeta?.channel;
  if (fromGateway != null) return channelWord(fromGateway, t);
  return channelWord(INBOX_CHANNELS[inboxChannelType] ?? null, t);
};

const languageFor = (lang, t) => {
  const word = LANG_WORDS[String(lang ?? '').toLowerCase()];
  return word ? word(t) : null;
};

// "store · channel · language", each part left out when unknown.
export const headerMeta = ({
  storeKey,
  stores,
  draftMeta,
  inboxChannelType,
  t,
}) => {
  const index = (stores ?? []).findIndex(s => s.key === storeKey);
  const store = storeKey && index !== -1 ? stores[index] : null;
  const storeName = store ? (store.name ?? store.key) : null;
  const storeIndex = store ? (index % 5) + 1 : null;
  const channel = channelFor(draftMeta, inboxChannelType, t);
  const language = languageFor(draftMeta?.lang, t);
  const line = [storeName, channel, language].filter(Boolean).join(' · ');
  return { storeName, storeIndex, channel, language, line };
};
