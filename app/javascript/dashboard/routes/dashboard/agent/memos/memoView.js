// How a memo is described: who taught it and where ("From", the audit a desk
// reads), its kind with any until date, the body the controller takes, and a
// proposal's stores.
const M = 'GOTCHU_AGENT.MEMO.';

// chatwoot:<id> is a person on this desk; cli:<name> an operator (the actor
// shape the gateway accepts); anything else predates both and came from Lark.
const nameOf = (author, agentsById, t) => {
  const person = /^chatwoot:(\d+)$/.exec(author ?? '');
  if (person) return agentsById[person[1]]?.name ?? `#${person[1]}`;
  const operator = /^cli:(.+)$/.exec(author ?? '');
  if (operator) return operator[1];
  return t(`${M}VIA_LARK`);
};

const ORIGIN_KEYS = {
  instruction: 'FROM_CONVERSATION',
  composer: 'FROM_CONVERSATION',
  proposal: 'FROM_PROPOSAL',
  screen: 'FROM_SCREEN',
};

// An edit keeps the memo's origin and adds who edited it, so "From" survives
// the supersede (spec §6.2).
export const originLabel = (memo, agentsById, t) => {
  const { source, author } = memo.origin;
  if (source === 'proposal' && author?.startsWith('system:')) {
    return { key: `${M}FROM_PROPOSAL_AUTO`, params: {} };
  }
  const name = nameOf(author, agentsById, t);
  const base = ORIGIN_KEYS[source] ?? 'FROM_SCREEN';
  if (memo.editedBy) {
    return {
      key: `${M}${base}_EDITED`,
      params: { name, editor: nameOf(memo.editedBy, agentsById, t) },
    };
  }
  return { key: `${M}${base}`, params: { name } };
};

const shortDate = iso =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

// `KIND_UNTIL`'s `kind` param is itself a key: resolve it with
// `t(label.key, { ...label.params, kind: t(label.params.kind) })`.
export const kindLabel = memo => {
  const kind = `${M}KIND.${memo.kind.toUpperCase()}`;
  return memo.expiresAt
    ? {
        key: `${M}KIND_UNTIL`,
        params: { kind, date: shortDate(memo.expiresAt) },
      }
    : { key: kind, params: {} };
};

export const memoBody = form => ({
  text: form.text.trim(),
  kind: form.kind,
  scope: { store_key: form.scope.storeKey, inbox_id: form.scope.inboxId },
  ...(form.until ? { until: form.until } : {}),
});

// memo_proposal.store_keys stores all stores as '' (spec §11).
export const proposalStores = (storeKeys, t) =>
  storeKeys
    .map(key => (key === '' ? t('GOTCHU_AGENT.SCOPE.ALL_STORES') : key))
    .join(', ');
