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
  def request(verb:, path:, **opts)
    query = opts.fetch(:query, {})
    body = opts[:body]
    timeout = opts.fetch(:timeout, TIMEOUT_SECONDS)
    refusals = opts.fetch(:refusals, {})

    response = perform_http(verb, path, query, body, timeout)
    return parse(response) if response.code == 200

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
