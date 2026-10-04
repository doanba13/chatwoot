export const CHANNELS = ['email', 'messenger', 'web'];
const P = 'GOTCHU_AGENT.PROCEDURE.';

// No row is Off: `triggersFor` joins on the binding, so the procedure never
// matches on that channel. Status is not consulted; the page shows it beside
// the tier, exactly as the overview's `tiers` does (spec §11).
export const tierFor = (bindings, channel) =>
  bindings.find(b => b.channel === channel)?.tier ?? 'off';

// Why Auto cannot be chosen on this channel, or null when it can. This only
// words what the gateway already decided (`channels[ch].autoPossible`,
// `autoSendEnabled`); the gateway refuses an Auto it would not allow anyway.
const autoReason = (procedure, channel) => {
  if (procedure.status !== 'active') return `${P}AUTO_OFF_NOT_ACTIVE`;
  if (!procedure.channels?.[channel]?.autoPossible)
    return `${P}AUTO_OFF_UNVERIFIABLE`;
  if (!procedure.autoSendEnabled) return `${P}AUTO_OFF_STORE`;
  return null;
};

export const tierOptions = (procedure, channel) => {
  const reasonKey = autoReason(procedure, channel);
  return [
    { value: 'off', disabled: false, reasonKey: null },
    { value: 'hand_over', disabled: false, reasonKey: null },
    { value: 'draft', disabled: false, reasonKey: null },
    { value: 'auto', disabled: reasonKey !== null, reasonKey },
  ];
};

// Board 3: "Sends 60 s after drafting…", from the gateway's holdSeconds;
// the hold in words only when the gateway gives no number.
export const holdHint = procedure =>
  Number.isInteger(procedure.holdSeconds)
    ? {
        key: `${P}AUTO_HINT_SECONDS`,
        params: { seconds: procedure.holdSeconds },
      }
    : { key: `${P}AUTO_HINT`, params: {} };
