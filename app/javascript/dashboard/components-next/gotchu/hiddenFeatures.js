import { FEATURE_FLAGS } from 'dashboard/featureFlags';

// Chatwoot's paid features. The rail does not link to them and the install
// runs with DISABLE_ENTERPRISE, so a typed URL lands on a paywall or a screen
// that cannot work. Gate the route rather than restyling the paywall.
// HELP_CENTER is absent on purpose: Chatwoot lists it as premium, but Help
// Center is a kept, working rail entry.
export const HIDDEN_FEATURE_FLAGS = [
  FEATURE_FLAGS.CAPTAIN,
  FEATURE_FLAGS.CAPTAIN_V2,
  FEATURE_FLAGS.CAPTAIN_CUSTOM_TOOLS,
  FEATURE_FLAGS.CAPTAIN_TASKS,
  FEATURE_FLAGS.CAPTAIN_DOCUMENT_AUTO_SYNC,
  FEATURE_FLAGS.SLA,
  FEATURE_FLAGS.CUSTOM_ROLES,
  FEATURE_FLAGS.AUDIT_LOGS,
  FEATURE_FLAGS.SAML,
];

export const isHiddenRoute = to => {
  const records = [...(to?.matched || []), to].filter(Boolean);
  return records.some(record =>
    HIDDEN_FEATURE_FLAGS.includes(record.meta?.featureFlag)
  );
};
