/**
 * What the dock body shows. A translation belongs to one draft (cycle and
 * version, invariant 6): one for any other is dropped, never shown. This only
 * picks display text; approval and send keep using `draft.version` and the
 * original body and never see the translation.
 */
export function pickDraftText({ draft, translation, enabled }) {
  const original = { text: draft?.body ?? '', translated: false };
  if (!enabled || !translation?.text) return original;
  if (
    translation.version !== draft?.version ||
    translation.cycleId !== draft?.cycleId
  ) {
    return original;
  }
  return { text: translation.text, translated: true };
}
