class Gotchu::ProcedureService
  # The error vocabulary lives on Gotchu::GatewayClient now, shared with the
  # rule, memo, store-list and agent services. These aliases keep every
  # existing `rescue_from Gotchu::ProcedureService::…Error` line working.
  # Each class's reason is documented where it is defined.
  ConfigurationError = Gotchu::GatewayClient::ConfigurationError
  UnavailableError = Gotchu::GatewayClient::UnavailableError
  ValidationError = Gotchu::GatewayClient::ValidationError
  NotFoundError = Gotchu::GatewayClient::NotFoundError
  ConflictError = Gotchu::GatewayClient::ConflictError

  # A binding write's 409 covers two different reasons under one status code
  # (apps/gateway/src/procedures.ts, the bindings route): the procedure was
  # revised after the screen read `expected_version` ("the procedure changed
  # since you opened it" -- reload and retry), or this channel is being
  # raised to auto on a procedure that is not currently 'active' ("only an
  # active procedure can be raised to auto"). Both messages are fixed,
  # contract strings the gateway itself defines -- never merchant- or
  # customer-authored free text, so `conflict_error_for` matching on them
  # below does not reopen the "never trust upstream text" rule the rest of
  # this codebase follows for scan text/grounded_in/etc.; the raw string
  # still never reaches the controller's JSON response, only the choice of
  # error class does. Subclasses ConflictError so a caller that only cares
  # "was this a conflict" still catches either with one rescue.
  class StaleVersionError < ConflictError; end
  class NotActiveForAutoError < ConflictError; end

  TIMEOUT_SECONDS = Gotchu::GatewayClient::TIMEOUT_SECONDS

  # `handleReplay` (apps/gateway/src/procedures.ts) runs its OWN internal
  # budget — REPLAY_TIME_BUDGET_MS, 15 seconds — scanning up to 200
  # conversations, and can answer a partial result (`timedOut: true`) rather
  # than run forever. This proxy's timeout has to sit comfortably above that
  # budget, or the proxy is what cuts the connection, and a gateway that would
  # have returned an honest partial result never gets the chance to. 20s: 5
  # seconds of margin for the hop itself on top of the gateway's own ceiling.
  REPLAY_TIMEOUT_SECONDS = 20

  TRANSPORT_ERRORS = Gotchu::GatewayClient::TRANSPORT_ERRORS

  # See Gotchu::GatewayClient.available? for why this is per account and read
  # at call time.
  def self.available?(account_id:) = Gotchu::GatewayClient.available?(account_id: account_id)

  # `actor_id` is the SESSION's user id, established by the controller from
  # `Current.user` and never read out of the request body — the same rule
  # InstructService's own `actor_id` follows, for the same reason (invariant
  # 5 in the sibling repo: an unattributable change to merchant-authored
  # behaviour is precisely what this field exists to prevent).
  #
  # `account_id` is likewise the SESSION's account (`Current.account.id`),
  # never a param; the client uses it to pick the gateway secret and to send
  # the `X-Chatwoot-Account-Id` cross-check.
  def initialize(actor_id:, account_id:)
    @actor_id = actor_id
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # `?store=<key>` list. No store names every procedure, any store, for an
  # operator's overview; a named store scopes to that store (plus global).
  def list(store: nil)
    @client.request(
      verb: :get,
      path: '/api/procedures',
      query: store.present? ? { store: store } : {},
      refusals: { ValidationError => [400] }
    )
  end

  # Always created at status 'testing' — the gateway hardcodes this and
  # ignores anything sent under that key, so this method takes no status
  # parameter to offer one at all.
  def create(slug:, title:, text:, phrases:, store_key: nil)
    @client.request(
      verb: :post,
      path: '/api/procedures',
      body: { slug: slug, title: title, body: text, phrases: phrases, storeKey: store_key, actor: actor }.compact,
      refusals: { ValidationError => [400], ConflictError => [409] }
    )
  end

  # A new version. The slug is identity and cannot change here — the gateway
  # carries the existing row's slug over regardless of what travels — so this
  # method does not accept one.
  def revise(id:, title:, text:, phrases:)
    @client.request(
      verb: :post,
      path: "/api/procedures/#{id}/revisions",
      body: { title: title, body: text, phrases: phrases, actor: actor },
      refusals: { ValidationError => [400], NotFoundError => [404] }
    )
  end

  # testing | active | archived.
  def set_status(id:, status:)
    @client.request(
      verb: :post,
      path: "/api/procedures/#{id}/status",
      body: { status: status, actor: actor },
      refusals: { ValidationError => [400], NotFoundError => [404] }
    )
  end

  # The channel bindings currently set on one procedure -- one row per bound
  # channel; a channel with no row is "off" (global constraint: off is the
  # absence of a binding, never a tier value), so an empty `bindings` array
  # is a normal, fully-off answer, not a refusal.
  def bindings(id:)
    @client.request(verb: :get, path: "/api/procedures/#{id}/bindings", refusals: { NotFoundError => [404] })
  end

  # `tier` is 'draft' | 'auto' | nil. `nil` ("off") is sent as an explicit
  # `tier: null` in the body -- the gateway's own contract for removing this
  # channel's binding -- so unlike create/revise's bodies this one is never
  # run through `.compact`.
  #
  # `expected_version` is a PRECONDITION only: the procedure revision the
  # edit screen had loaded when this row was changed. It travels as
  # `expectedVersion`, never `authorisedVersion` and never `version` -- the
  # gateway derives and stamps the authorised version itself, inside the
  # transaction that raises a channel to auto (sibling repo invariant 36).
  # Optional at the gateway, but this proxy's one caller (ChannelTiers.vue)
  # always has a loaded procedure version and always sends it, so a stale
  # write is refused (409) rather than silently overwriting a race.
  def set_binding(id:, channel:, tier:, expected_version:)
    @client.request(
      verb: :put,
      path: "/api/procedures/#{id}/bindings/#{channel}",
      body: { tier: tier, actor: actor, expectedVersion: expected_version },
      refusals: { ValidationError => [400], NotFoundError => [404] },
      conflict_classifier: method(:conflict_error_for)
    )
  end

  # Match counts over the last N days — a collection route, not a member one:
  # a replay answers "what would my whole procedure SET have matched", scored
  # over the set. Narrowing to one procedure is `procedure_id`, a field in the
  # body, not a narrower URL. No `sample`: real-draft sampling was deliberately
  # removed from the gateway's HTTP surface (apps/gateway/src/procedures.ts),
  # so this method has nowhere to put one even if a caller offered it.
  def replay(days: nil, store_key: nil, procedure_id: nil)
    @client.request(
      verb: :post,
      path: '/api/procedures/replay',
      body: { days: days, storeKey: store_key, procedureId: procedure_id, actor: actor }.compact,
      timeout: REPLAY_TIMEOUT_SECONDS
    )
  end

  private

  def actor
    "chatwoot:#{@actor_id}"
  end

  # See StaleVersionError/NotActiveForAutoError above for why matching the
  # gateway's own fixed strings here is safe. Anything else -- a future
  # third reason this build has no class for, or a body it can't even parse
  # -- falls back to UnavailableError, not the generic ConflictError:
  # ConflictError's only current meaning is create's "duplicate slug"
  # (render_conflict's own hardcoded wording), which would be actively
  # misleading on this route. "Opaque and unconfirmed" is the same posture
  # `request` already takes for a status code it doesn't recognise at all.
  CONFLICT_MESSAGES = {
    'the procedure changed since you opened it' => StaleVersionError,
    'only an active procedure can be raised to auto' => NotActiveForAutoError
  }.freeze

  def conflict_error_for(response)
    payload = JSON.parse(response.body.to_s)
    # A 409 body that parses but isn't an object (an array, a bare string, a
    # number) has no `['error']` to read -- `Hash#[]` would raise a
    # NoMethodError/TypeError on anything else and turn a 409 into a 500.
    # Same "opaque and unconfirmed" fallback as an unrecognised message.
    return UnavailableError unless payload.is_a?(Hash)

    CONFLICT_MESSAGES.fetch(payload['error'], UnavailableError)
  rescue JSON::ParserError
    UnavailableError
  end
end
