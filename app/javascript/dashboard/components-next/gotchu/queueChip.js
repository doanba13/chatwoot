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

const shortText = raw =>
  typeof raw === 'string' && raw.length > 0 ? raw.slice(0, 100) : null;

// `reason` is `gotchu_reason`: the title of the rule that forced a hand-over,
// empty when the procedure tier or the model chose it (spec §11). Every writer
// clears it when `gotchu_state` moves on, and the chip drops it on any other
// state anyway, because a visitor can write it too.
export function queueChip(attrs, t) {
  const state = attrs?.gotchu_state;
  if (typeof state !== 'string' || !Object.hasOwn(LABELS, state)) return null;
  const entry = LABELS[state];
  const procedure = shortText(attrs.gotchu_procedure);
  const reason =
    state === 'handed_over' ? shortText(attrs.gotchu_reason) : null;
  return { label: t(entry.label), procedure, reason, agent: entry.agent };
}
