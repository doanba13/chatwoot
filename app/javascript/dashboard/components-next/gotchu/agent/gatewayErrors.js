// What a failed Agent-page request says, as a GOTCHU_AGENT.ERRORS key. The
// controllers answer a fixed `{ error, reason }`; only the status decides the
// wording here, so no gateway text can reach the page.
const K = 'GOTCHU_AGENT.ERRORS.';

export const gatewayErrorKey = error => {
  const status = error?.response?.status;
  if (status === 409) return `${K}CHANGED`;
  if (status === 404) return `${K}NOT_FOUND`;
  if (status === 422 || status === 400) return `${K}INVALID`;
  if (status === 401 || status === 403) return `${K}FORBIDDEN`;
  if (status === 503) return `${K}UNCONFIGURED`;
  return `${K}UNAVAILABLE`;
};
