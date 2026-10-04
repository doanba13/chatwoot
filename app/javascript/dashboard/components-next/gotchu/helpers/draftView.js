/**
 * The gateway's draft payload, turned into what the dock can render.
 *
 * Pure on purpose, and separate from the component that fetches: this mapping is
 * the whole correctness question of the draft dock, and the wrong answer is not a
 * crash — it is a finished reply shown above the editor as though it were waiting
 * for review, one Insert away from being sent again.
 *
 * The payload contract, from apps/gateway/src/handlers.ts (`DraftBody`):
 *
 *   { cycle: { id, state, storeKey, expiresAt, tier } | null,
 *     draft: { version, body } | null }
 *
 * `cycle: null` and `draft: null` are both ordinary outcomes there, not errors.
 * Most conversations have never had a draft.
 */

/**
 * Why there is nothing to review — never "it just is".
 *
 * Only three of these reach the screen. In the composer the dock is "streaming,
 * then ready, then gone", so every ordinary empty case renders nothing at all: a
 * permanent "no draft" band above the editor would be noise on every
 * conversation in the inbox. The three FAULT reasons are the exception, and for
 * the reason the panel names a PII-denied Shopify field instead of rendering a
 * blank — a blank reads as "there is no draft" and sends an agent hunting a bug
 * that does not exist. See `NOTICE_KEYS` in DraftDockContainer.
 *
 * The cycle-state reasons are still told apart here, and deliberately, although
 * nothing renders them today. Two of them are opposite facts about the same
 * conversation — never drafted, versus a draft nobody read in time, which is 47%
 * of real cycles — and the distinction is worth somewhere to say it. This mapping
 * is where it survives until there is.
 */
export const EMPTY_REASONS = Object.freeze({
  /** The first read for this conversation has not come back yet. */
  LOADING: 'loading',
  /** No cycle at all: the worker has never drafted here. */
  NEVER: 'never',
  /** A cycle is waiting for review but carries no draft body yet. */
  PENDING: 'pending',
  /** A draft was written here and the review window closed on it. */
  EXPIRED: 'expired',
  SENT: 'sent',
  SUPERSEDED: 'superseded',
  HELD: 'held',
  /**
   * A cycle state this build does not recognise.
   *
   * Deliberately its own answer rather than a fallback onto the nearest known
   * state, on the same reasoning as invariant 23 for 17track statuses: a guessed
   * state is a lie the surface will tell confidently, and the reply loop's state
   * machine is not owned by this repo. Nothing is rendered for it — what matters
   * is that it never renders the draft body as though it were up for review.
   */
  UNKNOWN_STATE: 'unknown_state',
  /** The gateway did not answer (Rails answers 502). */
  UNAVAILABLE: 'unavailable',
  /** The gateway is not configured on this Chatwoot (Rails answers 503). */
  UNCONFIGURED: 'unconfigured',
  /** Anything else, including a 200 whose body is not the contract. */
  FAILED: 'failed',
});

/** Cycle states that mean "there is nothing here to review", and why. */
const EMPTY_FOR_CYCLE_STATE = Object.freeze({
  expired: EMPTY_REASONS.EXPIRED,
  sent: EMPTY_REASONS.SENT,
  superseded: EMPTY_REASONS.SUPERSEDED,
  held: EMPTY_REASONS.HELD,
});

/**
 * An ISO timestamp or nothing. The field arrives from a queue this build does
 * not own, so a non-string is dropped here rather than handed to `Date.parse`.
 */
const expiryOf = cycle =>
  typeof cycle?.expiresAt === 'string' ? cycle.expiresAt : null;

/**
 * The cycle an instruction would be about, or null.
 *
 * Carried on the view rather than read out of the payload a second time, so the
 * id a gesture names and the draft a supporter is looking at cannot come from
 * two different reads. A non-integer is dropped for the same reason `expiresAt`
 * is: the field arrives from a queue this build does not own.
 */
const cycleIdOf = cycle =>
  Number.isInteger(cycle?.id) && cycle.id > 0 ? cycle.id : null;

const emptyView = (reason, expiresAt = null, cycleId = null) => ({
  state: 'none',
  text: '',
  emptyReason: reason,
  expiresAt,
  cycleId,
});

/** The view while the first read for a conversation is still in flight. */
export const loadingView = () => emptyView(EMPTY_REASONS.LOADING);

/** The view for a failed read, by the status Rails answered with. */
export const errorView = status => {
  if (status === 503) return emptyView(EMPTY_REASONS.UNCONFIGURED);
  if (status === 502) return emptyView(EMPTY_REASONS.UNAVAILABLE);
  return emptyView(EMPTY_REASONS.FAILED);
};

/**
 * The dock state for one payload.
 *
 * `redrafting` is the one honest use of `streaming`: a new draft is genuinely
 * being produced, so the dock's own streaming header is telling the truth about
 * the world even though nothing is streaming down a wire. Every other non-review
 * state renders empty with its own reason — including `awaiting_review` with no
 * body yet, which is a cycle that exists and has not produced text.
 */
const viewFrom = payload => {
  if (!payload || typeof payload !== 'object') {
    return emptyView(EMPTY_REASONS.FAILED);
  }

  const { cycle, draft } = payload;
  if (!cycle || typeof cycle !== 'object') {
    return emptyView(EMPTY_REASONS.NEVER);
  }

  const expiresAt = expiryOf(cycle);
  const cycleId = cycleIdOf(cycle);

  if (cycle.state === 'redrafting') {
    return {
      state: 'streaming',
      text: '',
      emptyReason: null,
      expiresAt,
      cycleId,
    };
  }

  if (cycle.state === 'awaiting_review') {
    const body = typeof draft?.body === 'string' ? draft.body : '';
    return body
      ? { state: 'ready', text: body, emptyReason: null, expiresAt, cycleId }
      : emptyView(EMPTY_REASONS.PENDING, expiresAt, cycleId);
  }

  return emptyView(
    EMPTY_FOR_CYCLE_STATE[cycle.state] ?? EMPTY_REASONS.UNKNOWN_STATE,
    expiresAt,
    cycleId
  );
};

/**
 * The cycle's own tier (`reply_cycle.tier`), the row the release requires to
 * read `auto` before it approves: a string, `null` when the row has none, and
 * `undefined` when the gateway predates the field. That last one is its own
 * answer on purpose: "this gateway does not say" is not "the row says
 * nothing", and the header treats them differently.
 */
const cycleTierOf = payload => {
  const cycle = payload?.cycle;
  if (!cycle || typeof cycle !== 'object' || !('tier' in cycle)) {
    return undefined;
  }
  return typeof cycle.tier === 'string' ? cycle.tier : null;
};

/**
 * What the agent looked at to write the draft, as the gateway's structured
 * steps — worded by the container, not here. Carried on every view, an empty
 * list included, so nothing downstream has to ask whether the field exists.
 */
export const draftViewFrom = payload => ({
  ...viewFrom(payload),
  trace: Array.isArray(payload?.trace) ? payload.trace : [],
  cycleTier: cycleTierOf(payload),
});
