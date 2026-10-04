import { dynamicTime } from 'shared/helpers/timeHelper';

// The gateway's structured trace steps (spec §8.4), worded for AITrace. Here
// and only here, so the sentence for a step is decided in one place. A kind
// this build does not know is dropped rather than guessed at. Every field a
// step gained in revision 3 is optional: an older trace row still words with
// the sentence it always had.
const T = 'GOTCHU.TRACE.';

const joined = parts => parts.filter(Boolean).join(' · ');

// A resolver strategy with no phrase (contact_phone, fuzzy_address, a future
// one) is left out rather than shown as a raw key.
const foundByPhrase = (foundBy, t, te) => {
  if (!foundBy) return null;
  const key = `${T}FOUND_BY.${foundBy.toUpperCase()}`;
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  return te(key) ? t(key) : null;
};

const lineItemTitles = items =>
  (items ?? [])
    .slice(0, 3)
    .map(item => (typeof item === 'string' ? item : item?.title))
    .filter(Boolean)
    .join(', ');

const wordOrder = (step, t, te) => ({
  kind: 'order',
  did: t(`${T}ORDER`, { name: step.orderName }),
  result: joined([
    step.financialStatus,
    step.ageDays != null
      ? t(`${T}DAYS_OLD`, { n: step.ageDays }, step.ageDays)
      : null,
    foundByPhrase(step.foundBy, t, te),
    lineItemTitles(step.lineItems),
  ]),
});

const wordFulfillment = (step, t) => ({
  kind: 'fulfillment',
  did: t(`${T}TRACKING`),
  result: joined([
    step.state,
    step.trackingNumber,
    step.lastScanAt,
    step.syncedAt
      ? t(`${T}CHECKED_AGO`, {
          ago: dynamicTime(Date.parse(step.syncedAt) / 1000),
        })
      : null,
  ]),
});

const wordProcedure = (step, t) => ({
  kind: 'procedure',
  did:
    step.version != null
      ? t(`${T}PROCEDURE_V`, { title: step.title, version: step.version })
      : t(`${T}PROCEDURE`, { title: step.title }),
  result:
    step.score == null
      ? ''
      : t(step.runnerUp == null ? `${T}MATCH_ONLY` : `${T}MATCH`, {
          score: step.score,
          next: step.runnerUp,
        }),
});

const wordMemo = (step, t) => ({
  kind: 'memo',
  did: step.count
    ? t(`${T}MEMOS`, { n: step.count }, step.count)
    : t(`${T}MEMOS_NONE`),
  result: (step.memos ?? []).map(m => `“${m.excerpt}”`).join('; '),
});

const holdsSending = effect => effect && effect !== 'none';

// Why a skipped row was not shown. A missing fact holds sending only for a
// rule with a sending effect; the cap and an unreadable or out-of-scope row
// drop text only, so a sending effect is never left unsaid (spec §8.1, §8.4).
const skippedPhrase = (rule, t) => {
  const missing = rule.missing ?? [];
  const stillHolds = holdsSending(rule.effect) ? t(`${T}RULE_STILL_HOLDS`) : '';
  if (missing.length === 1 && missing[0] === 'inbox') {
    return `${t(`${T}RULE_INBOX_UNKNOWN`)}${stillHolds}`;
  }
  if (missing.length) {
    const key = holdsSending(rule.effect)
      ? `${T}RULE_MISSING`
      : `${T}RULE_MISSING_TEXT_ONLY`;
    return t(key, { facts: missing.join(', ') });
  }
  const REASONS = {
    render_cap: `${T}RULE_RENDER_CAP`,
    unreadable: `${T}RULE_UNREADABLE`,
  };
  return `${t(REASONS[rule.reason] ?? `${T}RULE_SKIPPED`)}${stillHolds}`;
};

const APPLIED_PHRASES = {
  never_auto: `${T}RULE_HOLDS`,
  hand_over: `${T}RULE_HANDS_OVER`,
  none: `${T}RULE_ADDS_TEXT`,
};

const rulePhrase = (rule, t) => {
  if (rule.outcome === 'would_apply') return t(`${T}RULE_TESTING`);
  if (rule.outcome === 'skipped') return skippedPhrase(rule, t);
  return t(APPLIED_PHRASES[rule.effect] ?? APPLIED_PHRASES.none);
};

// Testing rules last, so a supporter never reads one as having shaped the
// draft.
const wordRules = (step, t) => {
  const rules = step.rules ?? [];
  const applied = rules.filter(r => r.outcome === 'applied').length;
  const ordered = [
    ...rules.filter(r => r.outcome !== 'would_apply'),
    ...rules.filter(r => r.outcome === 'would_apply'),
  ];
  return {
    kind: 'rule',
    did: t(`${T}RULES`, { n: applied }),
    result: ordered.map(r => `${r.title} · ${rulePhrase(r, t)}`).join('; '),
  };
};

const wordRead = (step, t, te) => {
  const key = `${T}LANG.${(step.lang ?? 'none').toUpperCase()}`;
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  const lang = te(key) ? t(key) : step.lang;
  return { kind: 'read', did: t(`${T}READ`, { lang }), result: '' };
};

// Worded from `tier`, never from the absence of a refusal: `refusal: null`
// never means "will send" (spec §8.4). Whether an auto draft is released is
// decided later, at the end of the hold.
const wordTier = (step, t) => {
  let did;
  if (step.channel == null) did = t(`${T}TIER_CHANNEL_UNKNOWN`);
  else if (step.tier == null) did = t(`${T}TIER_NONE`);
  else {
    did = t(`${T}TIER`, {
      // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
      tier: t(`${T}TIERS.${step.tier.toUpperCase()}`),
      channel: step.channel,
    });
  }
  let result = t(`${T}TIER_WAIT`);
  if (step.refusal === 'rule_hold') result = t(`${T}TIER_RULE_HOLD`);
  else if (step.refusal === 'handover_tier') result = t(`${T}TIER_HANDOVER`);
  else if (step.tier === 'auto') result = t(`${T}TIER_AUTO`);
  return { kind: 'tier', did, result };
};

export const wordStep = (step, t, te) => {
  switch (step?.kind) {
    case 'order':
      return wordOrder(step, t, te);
    case 'fulfillment':
      return wordFulfillment(step, t);
    case 'policy':
      return { kind: 'policy', did: t(`${T}POLICY`), result: '' };
    case 'procedure':
      return wordProcedure(step, t);
    case 'memo':
      return wordMemo(step, t);
    case 'precedent':
      return {
        kind: 'precedent',
        did: t(`${T}PRECEDENTS`, { n: step.count }, step.count),
        result: '',
      };
    case 'rule':
      return wordRules(step, t);
    case 'read':
      return wordRead(step, t, te);
    case 'thread':
      return {
        kind: 'thread',
        did: t(
          `${T}THREAD`,
          { n: step.messagesInContext },
          step.messagesInContext
        ),
        result: '',
      };
    case 'tier':
      return wordTier(step, t);
    default:
      return null;
  }
};
