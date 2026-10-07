const pad = n => String(n).padStart(2, '0');

// Local calendar day, yyyy-mm-dd.
const dayKey = date =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/**
 * Interleave messages with the gateway's timeline into one ordered list, with
 * a `day` item opening every local calendar day that has anything in it.
 * A Gotchu line at the same second as a message goes after it.
 */
export const threadItems = ({ messages = [], timeline = [] } = {}) => {
  const entries = [];
  (messages || []).forEach(message => {
    entries.push({
      time: message.createdAt * 1000,
      rank: 0,
      item: { type: 'message', key: `msg-${message.id}`, message },
    });
  });
  (timeline || []).forEach(item => {
    const time = new Date(item.at).getTime();
    if (Number.isNaN(time)) return;
    entries.push({
      // The message clock is whole seconds; compare Gotchu lines on it too.
      time: Math.floor(time / 1000) * 1000,
      rank: 1,
      item: {
        type: 'gotchu',
        key: `g-${item.at}-${item.kind}-${item.version ?? ''}`,
        item,
      },
    });
  });
  entries.sort((a, b) => a.time - b.time || a.rank - b.rank);

  const result = [];
  let lastDay = null;
  entries.forEach(({ time, item }) => {
    const date = new Date(time);
    const day = dayKey(date);
    if (day !== lastDay) {
      result.push({ type: 'day', key: `day-${day}`, date });
      lastDay = day;
    }
    result.push(item);
  });
  return result;
};
