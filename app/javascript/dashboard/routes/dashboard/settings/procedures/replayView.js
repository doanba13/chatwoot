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

/**
 * The one number a per-row Replay is actually asking for: how many
 * conversations would have matched THIS procedure.
 *
 * `procedureId` on the request narrows `byProcedure` and nothing else --
 * `byResolution` is always computed over the whole active+testing set,
 * whatever `procedureId` was sent (task 9's report flagged this twice,
 * forward-looking to this exact screen). Reading `byResolution.matched`
 * here would answer a different question than the one a merchant asked by
 * pressing Replay on one specific row -- a number that does not mean what
 * it claims.
 *
 * `byProcedure` is a list rather than a single count because the API answers
 * the same shape whether or not a `procedureId` filter was sent (task 9's
 * own design); when it was sent, as it always is from this screen, it holds
 * at most one entry. No entry at all means this procedure matched nothing in
 * the scanned window, not that the read failed -- the caller already knows
 * the read succeeded by the time this runs.
 */
export function replayMatchCount(result, procedureId) {
  const entry = (result?.byProcedure || []).find(
    p => p.procedureId === procedureId
  );
  return entry?.count ?? 0;
}
