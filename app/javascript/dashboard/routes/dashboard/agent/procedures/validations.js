/**
 * Mirrors `validateProcedure` in the sibling repo
 * (`packages/reply/src/procedure/validate.ts`) for exactly the checks that
 * can be told from the form alone: the slug pattern, the length caps and the
 * phrase count. It does NOT reimplement `looksCaseSpecific` -- that guard
 * reads the text for whether it names a specific customer or order, which
 * this form cannot decide any more honestly than the gateway's own refusal
 * already does. Surfacing what we CAN check before submit means the common
 * refusal (a typo'd slug, a too-long body, too many phrases) never costs the
 * merchant a round trip; the rest is still the gateway's to catch, and its
 * `reason` is what the form shows when it does (see errors.js).
 */

export const SLUG_PATTERN = /^[a-z0-9_]{3,40}$/;
export const MAX_TITLE_LENGTH = 100;
export const MAX_BODY_LENGTH = 4000;
export const MAX_PHRASES = 12;
export const MIN_PHRASES = 1;

export function slugError(slug) {
  const value = (slug || '').trim();
  if (!value) return 'PROCEDURES_MGMT.FORM.SLUG.REQUIRED_ERROR';
  if (!SLUG_PATTERN.test(value))
    return 'PROCEDURES_MGMT.FORM.SLUG.PATTERN_ERROR';
  return '';
}

export function titleError(title) {
  const value = (title || '').trim();
  if (!value) return 'PROCEDURES_MGMT.FORM.TITLE.REQUIRED_ERROR';
  if (title.length > MAX_TITLE_LENGTH)
    return 'PROCEDURES_MGMT.FORM.TITLE.LENGTH_ERROR';
  return '';
}

export function bodyError(body) {
  const value = (body || '').trim();
  if (!value) return 'PROCEDURES_MGMT.FORM.BODY.REQUIRED_ERROR';
  if (body.length > MAX_BODY_LENGTH)
    return 'PROCEDURES_MGMT.FORM.BODY.LENGTH_ERROR';
  return '';
}

export function phrasesError(phrases) {
  const list = phrases || [];
  if (list.length < MIN_PHRASES)
    return 'PROCEDURES_MGMT.FORM.PHRASES.MIN_ERROR';
  if (list.length > MAX_PHRASES)
    return 'PROCEDURES_MGMT.FORM.PHRASES.MAX_ERROR';
  return '';
}

/**
 * `slug` is omitted entirely on an edit -- the slug is identity and never
 * travels on a revision (`ProceduresController#update` carries the existing
 * row's slug over regardless of what a caller sends) -- so this only checks
 * it when the caller passes one at all, rather than requiring every caller
 * to pass a placeholder.
 */
export function isProcedureFormValid({ slug, title, body, phrases }) {
  if (slug !== undefined && slugError(slug)) return false;
  return !titleError(title) && !bodyError(body) && !phrasesError(phrases);
}
