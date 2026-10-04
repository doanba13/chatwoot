// The rule editor's form: what it starts from, how a stored rule fills it,
// the body the controller takes, and the problems the page can name before
// any request. The gateway's save-time checks (spec §10) still decide; these
// only spare a round trip on the common cases.
const R = 'GOTCHU_AGENT.RULE.';

export const emptyForm = () => ({
  title: '',
  say: '',
  sending: 'no_change',
  conditions: [],
  scope: { storeKey: null, inboxId: null, exceptInboxIds: [] },
});

export const formFromRule = rule => ({
  title: rule.title,
  say: rule.say ?? '',
  sending: rule.sending,
  conditions: rule.conditions.all.map(c => ({ ...c })),
  scope: { ...rule.scope, exceptInboxIds: [...rule.scope.exceptInboxIds] },
});

// Rails params are snake_case; the controller maps scope to the gateway's
// camelCase. A blank `say` is null, so a sending-only rule is a real rule.
export const toBody = form => ({
  title: form.title.trim(),
  say: form.say.trim() === '' ? null : form.say.trim(),
  sending: form.sending,
  conditions: { v: 1, all: form.conditions },
  scope: {
    store_key: form.scope.storeKey,
    inbox_id: form.scope.inboxId,
    except_inbox_ids: form.scope.exceptInboxIds,
  },
});

const isTextDerived = (facts, name) =>
  facts.find(f => f.name === name)?.origin === 'customer_text';

// A fact read from what the customer wrote may only add text: with any
// sending effect it is disabled, with the reason (spec §5.2,
// `text_derived_fact`).
export const factOptions = (facts, sending, t, te) =>
  facts.map(f => {
    const blocked = sending !== 'no_change' && f.origin === 'customer_text';
    const key = `${R}FACTS.${f.name.toUpperCase()}`;
    return {
      value: f.name,
      label: te(key) ? t(key) : f.name,
      disabled: blocked,
      reasonKey: blocked ? `${R}LANGUAGE_NEEDS_NO_CHANGE` : null,
    };
  });

const outOfRange = (facts, c) => {
  const f = facts.find(x => x.name === c.fact);
  if (!f || f.valueType !== 'number') return false;
  return (
    (f.min != null && c.value < f.min) || (f.max != null && c.value > f.max)
  );
};

// A row with no fact or operator, or a list fact with no value yet: the
// gateway would refuse it with its parser's words, so the page names it.
const unfinished = c =>
  !c.fact || !c.op || (Array.isArray(c.value) && c.value.length === 0);

export const localProblems = (form, facts) => {
  const problems = [];
  if (!form.title.trim()) problems.push(`${R}PROBLEM_TITLE`);
  if (form.conditions.some(unfinished))
    problems.push(`${R}PROBLEM_INCOMPLETE_CONDITION`);
  if (form.say.trim() === '' && form.sending === 'no_change')
    problems.push(`${R}PROBLEM_DOES_NOTHING`);
  if (
    form.sending !== 'no_change' &&
    form.conditions.some(c => isTextDerived(facts, c.fact))
  ) {
    problems.push(`${R}PROBLEM_TEXT_DERIVED`);
  }
  if (form.conditions.some(c => outOfRange(facts, c)))
    problems.push(`${R}PROBLEM_OUT_OF_RANGE`);
  return problems;
};
