const R = 'GOTCHU_AGENT.RULE.';

export const sendingKey = sending => `${R}SENDING.${sending.toUpperCase()}`;

// A testing rule has shaped nothing: its count is what it would have applied
// to, and the list says so.
export const usedLabel = rule => ({
  key: rule.status === 'testing' ? `${R}WOULD_APPLY` : `${R}USED`,
  n: rule.usedLast7d,
});

// `DemotedBinding.title` is required by the contract (spec §11), so the fork
// never looks a title up; the id is only a fallback for a row that lacks one.
export const demotedTitle = binding =>
  binding.title || `#${binding.procedureId}`;

// One chip per condition: "<Fact label> <value>". Labels come from the locale
// by fact name; a fact this build has no label for shows its raw name rather
// than vanishing, because a hidden condition is a rule that looks broader
// than it is.
export const conditionChips = (conditions, t, te) =>
  conditions.all.map(c => {
    const key = `${R}FACTS.${c.fact.toUpperCase()}`;
    const value = Array.isArray(c.value) ? c.value.join(', ') : String(c.value);
    return { label: te(key) ? t(key) : c.fact, op: c.op, value };
  });
