class Gotchu::ProcedureService
  # Raised when the gateway is not configured on this Chatwoot. Its own class,
  # for the reason DraftService/InstructService give: a missing env var is an
  # operator error, and reporting it as a refusal would send a merchant
  # looking at their procedure text instead of an operator looking at the
  # deployment.
  class ConfigurationError < StandardError; end

  # Raised for anything the gateway failed to do, or did not answer in time —
  # including any response shape or status code none of the classes below
  # claim. "Could not confirm", never "did not happen".
  class UnavailableError < StandardError; end

  # The gateway answered, and said the request itself was malformed: a bad
  # status value, a missing field, an unknown store. A supporter — here, an
  # administrator filling in the settings screen — can act on this one, which
  # is why it is not folded into UnavailableError.
  class ValidationError < StandardError; end

  # The gateway answered 404 on a per-id route (revise, status). Same
  # ambiguity InstructService::REFUSED_CODES already lives with: server.ts's
  # shared write guard also 404s every procedure route, including these two,
  # when GESTURE_SURFACE is dark, and that is indistinguishable at this end
  # from "no procedure at that id". Both are refusals a caller can act on
  # (reload the list), never a cause nobody observed.
  class NotFoundError < StandardError; end

  # The gateway answered 409: create was asked to reuse a (store, slug) pair
  # that already has a procedure.
  class ConflictError < StandardError; end

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

  # A settings-screen submit, and the administrator is waiting on a keypress.
  # Same budget as the gesture routes in InstructService, for the same
  # reason: the gateway answers from a database read/write behind a local hop.
  TIMEOUT_SECONDS = 3

  # `handleReplay` (apps/gateway/src/procedures.ts) runs its OWN internal
  # budget — REPLAY_TIME_BUDGET_MS, 15 seconds — scanning up to 200
  # conversations, and can answer a partial result (`timedOut: true`) rather
  # than run forever. This proxy's timeout has to sit comfortably above that
  # budget, or the proxy is what cuts the connection, and a gateway that would
  # have returned an honest partial result never gets the chance to. 20s: 5
  # seconds of margin for the hop itself on top of the gateway's own ceiling.
  REPLAY_TIMEOUT_SECONDS = 20

  # Every way the hop to the gateway can fail without the gateway answering,
  # plus a body that is not the JSON it promised. Same list DraftService uses:
  # Errno::* is SystemCallError, and both Net::OpenTimeout and
  # Net::ReadTimeout are Timeout::Error.
  TRANSPORT_ERRORS = [
    HTTParty::Error,
    Timeout::Error,
    SocketError,
    SystemCallError,
    OpenSSL::SSL::SSLError,
    EOFError,
    JSON::ParserError
  ].freeze

  # Whether the procedure screen can reach the gateway from this deployment at
  # all. Three env vars, because every procedure route — including the list,
  # unlike DraftService's read — demands both credentials: the shared
  # `/api/*` secret in the query string AND `GESTURE_SHARED_SECRET` in the
  # `x-gesture-secret` header (server.ts: "GET /api/procedures is the one
  # read among them... still gated by the dark switch and both secrets like
  # everything else in this block").
  #
  # Read at call time, never memoized: this is what the controller's index
  # action uses to decide whether to call the gateway at all, so turning the
  # feature on is an env var and a container restart, never a rebuild.
  def self.available?
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # `actor_id` is the SESSION's user id, established by the controller from
  # `Current.user` and never read out of the request body — the same rule
  # InstructService's own `actor_id` follows, for the same reason (invariant
  # 5 in the sibling repo: an unattributable change to merchant-authored
  # behaviour is precisely what this field exists to prevent).
  def initialize(actor_id:)
    @actor_id = actor_id
  end

  # `?store=<key>` list. No store names every procedure, any store, for an
  # operator's overview; a named store scopes to that store (plus global).
  def list(store: nil)
    request(
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
    request(
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
    request(
      verb: :post,
      path: "/api/procedures/#{id}/revisions",
      body: { title: title, body: text, phrases: phrases, actor: actor },
      refusals: { ValidationError => [400], NotFoundError => [404] }
    )
  end

  # testing | active | archived.
  def set_status(id:, status:)
    request(
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
    request(verb: :get, path: "/api/procedures/#{id}/bindings", refusals: { NotFoundError => [404] })
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
    request(
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
    request(
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
    message = JSON.parse(response.body.to_s)['error']
    CONFLICT_MESSAGES.fetch(message, UnavailableError)
  rescue JSON::ParserError
    UnavailableError
  end

  # `refusals` maps an exception class to the status codes THIS call's own
  # gateway route can answer with something other than success — see
  # procedures.ts's individual handlers, which vary per route (list only
  # ever 400s; create alone can 409; revise/status alone can 404). Any code
  # outside that map, or no answer at all, is UnavailableError: opaque on
  # purpose, so a 403 (credentials rejected) or a 5xx (the gateway's own
  # upstream failure) is never mistaken for a clean business refusal.
  #
  # Takes `**opts` rather than five more named keywords purely to stay under
  # rubocop's Metrics/ParameterLists — every caller below still passes named
  # arguments, just gathered into one hash first.
  #
  # `conflict_classifier`, when given, is called on a 409 response *before*
  # `refusals` is consulted, and must return the exception class to raise —
  # `set_binding`'s own `conflict_error_for` is the one caller that needs
  # this, because that single route's 409 covers two distinct causes
  # (`conflict_error_for`'s own comment). Every other call site leaves it
  # nil and keeps mapping 409 through the plain `refusals` table.
  def request(verb:, path:, **opts)
    query = opts.fetch(:query, {})
    body = opts[:body]
    timeout = opts.fetch(:timeout, TIMEOUT_SECONDS)
    refusals = opts.fetch(:refusals, {})
    conflict_classifier = opts[:conflict_classifier]

    response = perform_http(verb, path, query, body, timeout)
    return parse(response) if response.code == 200

    if conflict_classifier && response.code == 409
      raise conflict_classifier.call(response), "gateway responded with #{response.code}"
    end

    refusals.each do |error_class, codes|
      raise error_class, "gateway responded with #{response.code}" if codes.include?(response.code)
    end

    raise UnavailableError, "gateway responded with #{response.code}"
  rescue *TRANSPORT_ERRORS => e
    raise UnavailableError, "#{e.class}: #{e.message}"
  end

  def perform_http(verb, path, query, body, timeout)
    options = {
      # The panel secret rides in the query string on every route, including
      # the read: the gateway demands it there and the header credential in
      # addition, never instead.
      query: { secret: secret }.merge(query),
      headers: headers(body),
      timeout: timeout
    }
    options[:body] = body.to_json if body
    HTTParty.public_send(verb, "#{base_url}#{path}", options)
  end

  def headers(body)
    h = {
      # Required on every procedure route, the list included — the one read
      # among the gesture-guarded routes, but still behind both secrets.
      'x-gesture-secret' => gesture_secret
    }
    # Not sent on the list route: it is a GET with no body, and the gateway
    # does not demand a content type there (server.ts's own isProcedureList
    # exception to the write-route content-type rule).
    h['Content-Type'] = 'application/json' if body
    h
  end

  def parse(response)
    payload = JSON.parse(response.body.to_s)
    raise UnavailableError, "gateway returned #{payload.class} instead of an object" unless payload.is_a?(Hash)

    payload
  end

  def base_url
    @base_url ||= ENV.fetch('GOTCHU_GATEWAY_URL', nil).presence&.chomp('/') ||
                  raise(ConfigurationError, 'GOTCHU_GATEWAY_URL is not set')
  end

  def secret
    @secret ||= ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).presence ||
                raise(ConfigurationError, 'GOTCHU_GATEWAY_SECRET is not set')
  end

  def gesture_secret
    @gesture_secret ||= ENV.fetch('GOTCHU_GESTURE_SECRET', nil).presence ||
                        raise(ConfigurationError, 'GOTCHU_GESTURE_SECRET is not set')
  end
end
