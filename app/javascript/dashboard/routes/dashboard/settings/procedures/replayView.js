/**
 * What to say about a replay's scope, honestly.
 *
 * A window capped by conversation count and a window cut off by the day
 * range are different statements -- "the last 200 conversations" is not the
 * same claim as "the last {days} days" -- and collapsing both into a bare
 * count loses exactly the distinction the brief's replay-honesty rule exists
 * to keep. `cappedByWindow` picks which one is true.
 */
export function replayScopeView({ days, considered, cappedByWindow } = {}) {
  return cappedByWindow
    ? { key: 'PROCEDURES_MGMT.REPLAY.SCOPE_CAPPED', params: { considered } }
    : { key: 'PROCEDURES_MGMT.REPLAY.SCOPE', params: { days, considered } };
}

/**
 * Whether the scan's own numbers are partial -- the gateway's internal time
 * budget cut it off before every candidate in scope was scored, so what came
 * back is real but incomplete. A partial number presented as a complete one
 * is exactly the failure this helper exists to avoid, per the brief.
 */
export function replayIsPartial({ timedOut } = {}) {
  return timedOut === true;
}
