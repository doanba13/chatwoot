const P = 'GOTCHU.THREAD';
const CHANNEL_KEYS = {
  email: 'EMAIL',
  messenger: 'MESSENGER',
  web: 'WEB',
};

const senderName = (message, t) => message.sender?.name || t(`${P}.SOMEONE`);

export const isGotchuNote = message =>
  Boolean(message.private && message.contentAttributes?.gotchuNote === true);

// 'other' is an unmapped or unreadable inbox: name no channel at all.
export const channelWord = (channel, t) => {
  const key = CHANNEL_KEYS[channel];
  return key ? t(`GOTCHU.HEADER.CHANNEL.${key}`) : null;
};

// Worded from `edited` and who sent it, never from `author`.
export const bylineFor = ({ message, sentDraft, channelWord: channel, t }) => {
  const name = senderName(message, t);
  if (message.messageType === 0) {
    return {
      text: channel
        ? t(`${P}.BY_CUSTOMER`, { name, channel })
        : t(`${P}.BY_CUSTOMER_NO_CHANNEL`, { name }),
      lock: false,
    };
  }
  if (message.private) {
    return { text: t(`${P}.BY_NOTE`, { name }), lock: true };
  }
  if (sentDraft) {
    const { version } = sentDraft;
    let key = 'BY_SENT_EDITED';
    if (sentDraft.auto === true || sentDraft.sentBy === 'auto') {
      key = 'BY_SENT_AUTO';
    } else if (sentDraft.edited === false) {
      key = 'BY_SENT_UNEDITED';
    }
    return { text: t(`${P}.${key}`, { name, version }), lock: false };
  }
  return { text: name, lock: false };
};

const withVersion = (item, t, base) =>
  Number.isInteger(item.version)
    ? t(`${P}.LINE.${base}`, { version: item.version })
    : t(`${P}.LINE.${base}_PLAIN`);

// null for a kind this build does not know: never show a raw kind.
export const timelineSentence = (item, t) => {
  const title = item.procedureTitle;
  switch (item.kind) {
    case 'drafted':
      return title
        ? t(`${P}.LINE.DRAFTED`, { title })
        : t(`${P}.LINE.DRAFTED_NO_PROCEDURE`);
    case 'redrafted':
      return withVersion(item, t, 'REDRAFTED');
    case 'auto_scheduled':
      return withVersion(item, t, 'AUTO_SCHEDULED');
    case 'auto_sent':
      return withVersion(item, t, 'AUTO_SENT');
    case 'auto_stopped':
      return t(`${P}.LINE.AUTO_STOPPED`);
    case 'handed_over':
      return title
        ? t(`${P}.LINE.HANDED_OVER_PROCEDURE`, { title })
        : t(`${P}.LINE.HANDED_OVER`);
    case 'memo_added':
      return t(`${P}.LINE.MEMO_ADDED`);
    default:
      return null;
  }
};

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const dayLabel = (date, now, t, locale) => {
  if (sameDay(date, now)) return t(`${P}.TODAY`);
  const yesterday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  );
  if (sameDay(date, yesterday)) return t(`${P}.YESTERDAY`);
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date);
};
