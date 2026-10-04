// Where a rule or memo applies, in the words a merchant reads (spec §3). An
// inbox this account no longer lists keeps its number rather than a blank,
// because a blank reads as "applies everywhere".
const inboxName = (id, inboxes) => {
  const inbox = inboxes.find(i => i.id === id);
  return inbox ? `${inbox.name} #${id}` : `#${id}`;
};

export const scopeLabel = (scope, { inboxes }) => ({
  store: scope.storeKey,
  inbox: scope.inboxId == null ? null : inboxName(scope.inboxId, inboxes),
  except: (scope.exceptInboxIds ?? []).map(id => inboxName(id, inboxes)),
});

// A store's own inboxes first, then the account's unmapped (shared) inboxes,
// such as the one Support Mail every store forwards into. Another store's
// inbox is never offered.
export const inboxOptions = (storeKey, { stores, inboxes }) => {
  const store = stores.find(s => s.key === storeKey);
  if (!store) return [];
  const mapped = new Set(stores.flatMap(s => s.inboxes.map(i => i.id)));
  const own = store.inboxes.map(i => ({
    value: i.id,
    label: inboxName(i.id, inboxes),
    shared: false,
  }));
  const shared = inboxes
    .filter(i => !mapped.has(i.id))
    .map(i => ({ value: i.id, label: inboxName(i.id, inboxes), shared: true }));
  return [...own, ...shared];
};
