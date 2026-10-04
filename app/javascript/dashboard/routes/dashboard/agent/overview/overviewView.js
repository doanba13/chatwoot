// The overview's words. The fork never computes a number of its own
// (NORTH-STAR rule 3): a null share is a dash, never 0%.
const O = 'GOTCHU_AGENT.OVERVIEW.';

export const share = value =>
  value == null ? '—' : `${Math.round(value * 100)}%`;

export const secondsLeft = (firesAt, now) =>
  Math.max(0, Math.round((new Date(firesAt).getTime() - now.getTime()) / 1000));

// Only an active procedure can send on its own, so a testing procedure's
// stored Auto is not counted here; the table still shows it beside its
// Testing status.
export const statusSentence = overview => {
  const live = overview.procedures.filter(p => p.status === 'active');
  const auto = live.filter(p => Object.values(p.tiers ?? {}).includes('auto'));
  if (auto.length === 0) {
    return {
      key: `${O}STATUS_NO_AUTO`,
      params: { stores: overview.storeCount },
    };
  }
  const channels = [
    ...new Set(
      auto.flatMap(p =>
        Object.entries(p.tiers)
          .filter(([, tier]) => tier === 'auto')
          .map(([channel]) => channel)
      )
    ),
  ];
  return {
    key: `${O}STATUS_SOME_AUTO`,
    params: {
      stores: overview.storeCount,
      n: auto.length,
      channels: channels.join(', '),
    },
  };
};
