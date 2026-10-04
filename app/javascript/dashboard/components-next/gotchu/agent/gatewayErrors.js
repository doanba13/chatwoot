// What a failed Agent-page request says, as a GOTCHU_AGENT.ERRORS key. The
// controllers answer a fixed `{ error, reason }`; only the status decides the
// wording here, so no gateway text can reach the page.
const K = 'GOTCHU_AGENT.ERRORS.';

// Two 409s that are not a race: a create that reused a short name, and Auto
// asked of a procedure that is not active. Both reasons are the controllers'
// own fixed codes. "Changed since you opened it" would send the user
// reloading for nothing.
const CONFLICT_REASONS = {
  duplicate_slug: `${K}DUPLICATE_SLUG`,
  not_active_for_auto: `${K}NOT_ACTIVE_FOR_AUTO`,
};

export const gatewayErrorKey = error => {
  const status = error?.response?.status;
  if (status === 409) {
    return CONFLICT_REASONS[error.response.data?.reason] ?? `${K}CHANGED`;
  }
  if (status === 404) return `${K}NOT_FOUND`;
  if (status === 422 || status === 400) return `${K}INVALID`;
  if (status === 401 || status === 403) return `${K}FORBIDDEN`;
  if (status === 503) return `${K}UNCONFIGURED`;
  return `${K}UNAVAILABLE`;
};
