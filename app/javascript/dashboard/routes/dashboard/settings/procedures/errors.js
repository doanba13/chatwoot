/**
 * What to say about a request that did not land, by the reason CODE Rails
 * gave -- never the gateway's own words, which
 * `Gotchu::ProceduresController` deliberately does not forward (its own
 * comment: "The gateway's own words never reach the response, only the
 * log"). Each reason gets its own sentence rather than every refusal
 * collapsing into "invalid input" -- the brief's own requirement, because
 * the write-time guard is deliberately narrow and a refusal is informative.
 */
export const PROCEDURE_ERROR_KEYS = Object.freeze({
  unconfigured: 'PROCEDURES_MGMT.ERRORS.UNCONFIGURED',
  unavailable: 'PROCEDURES_MGMT.ERRORS.UNAVAILABLE',
  invalid: 'PROCEDURES_MGMT.ERRORS.INVALID',
  duplicate_slug: 'PROCEDURES_MGMT.ERRORS.DUPLICATE_SLUG',
  not_found: 'PROCEDURES_MGMT.ERRORS.NOT_FOUND',
});

/**
 * A response with no `reason`, or a reason this build does not recognise,
 * reads as `unavailable`: "could not confirm", never a guess at a cause
 * nobody observed -- the same posture `INSTRUCT_ERROR_KEYS` already takes in
 * `DraftDockContainer.vue`.
 */
export function procedureErrorKey(error) {
  const reason = error?.response?.data?.reason;
  return PROCEDURE_ERROR_KEYS[reason] ?? PROCEDURE_ERROR_KEYS.unavailable;
}
