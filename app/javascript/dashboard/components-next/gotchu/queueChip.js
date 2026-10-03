// What the agent last did, for a conversation row. Display only; the value
// can be written by a web-widget visitor, so every field is checked here.
const LABELS = {
  drafted: { label: 'CONVERSATION.GOTCHU_QUEUE.DRAFTED', agent: true },
  auto_holding: {
    label: 'CONVERSATION.GOTCHU_QUEUE.AUTO_HOLDING',
    agent: true,
  },
  handed_over: { label: 'CONVERSATION.GOTCHU_QUEUE.HANDED_OVER', agent: false },
  sent: { label: 'CONVERSATION.GOTCHU_QUEUE.SENT', agent: false },
};

export function queueChip(attrs, t) {
  const state = attrs?.gotchu_state;
  if (typeof state !== 'string' || !Object.hasOwn(LABELS, state)) return null;
  const entry = LABELS[state];
  const raw = attrs.gotchu_procedure;
  const procedure =
    typeof raw === 'string' && raw.length > 0 ? raw.slice(0, 100) : null;
  return { label: t(entry.label), procedure, agent: entry.agent };
}
