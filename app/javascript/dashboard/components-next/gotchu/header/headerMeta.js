import { channelWord } from '../thread/threadWords';
import { languageWord } from '../helpers/locale';
import { storeIndexIn } from '../agent/useGotchuStores';

const INBOX_CHANNELS = {
  'Channel::Email': 'email',
  'Channel::FacebookPage': 'messenger',
  'Channel::WebWidget': 'web',
};

// The gateway's channel when it said one (even 'other', which names nothing);
// the inbox only when it said nothing at all, i.e. no read yet or an old gateway.
const channelFor = (draftMeta, inboxChannelType, t) => {
  const fromGateway = draftMeta?.channel;
  if (fromGateway != null) return channelWord(fromGateway, t);
  return channelWord(INBOX_CHANNELS[inboxChannelType] ?? null, t);
};

// "store · channel · language", each part left out when unknown.
export const headerMeta = ({
  storeKey,
  stores,
  draftMeta,
  inboxChannelType,
  t,
}) => {
  const storeIndex = storeKey ? storeIndexIn(stores, storeKey) : null;
  const store = storeIndex ? stores.find(s => s.key === storeKey) : null;
  const storeName = store ? (store.name ?? store.key) : null;
  const channel = channelFor(draftMeta, inboxChannelType, t);
  const language = languageWord(draftMeta?.lang, t);
  const line = [storeName, channel, language].filter(Boolean).join(' · ');
  return { storeName, storeIndex, channel, language, line };
};
