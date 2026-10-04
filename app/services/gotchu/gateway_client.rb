# The one HTTP hop every Gotchu screen service makes to the gateway: the
# procedure, rule, memo, store-list and agent services sit on it and share its
# error vocabulary. StoreRoutesService and ShopifyService deliberately do not
# (their own header comments say why); they keep their own siblings.
class Gotchu::GatewayClient
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
  # that already has a procedure, or a precondition (expectedVersion) failed.
  class ConflictError < StandardError; end

  # A settings-screen submit, and the administrator is waiting on a keypress.
  # Same budget as the gesture routes in InstructService, for the same
  # reason: the gateway answers from a database read/write behind a local hop.
  TIMEOUT_SECONDS = 3

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

  # Whether a Gotchu screen can reach the gateway from this deployment for
  # THIS account -- the URL is install-wide, the gesture secret is
  # install-wide, but the gateway secret is resolved per account (see
  # `Gotchu::GatewaySecret.for_account`), so `available?` has to be too: an
  # account named only in `GOTCHU_GATEWAY_SECRETS`, with no install-wide
  # `GOTCHU_GATEWAY_SECRET` fallback set, is genuinely available even though
  # the single shared variable this used to check is blank. Takes
  # `account_id:` rather than reading `Current.account` itself: a class method
  # has no request context of its own, and a caller passing it explicitly is
  # what makes this testable without a controller in the loop.
  #
  # Read at call time, never memoized: this is what an index action uses to
  # decide whether to call the gateway at all, so turning the feature on is an
  # env var and a container restart, never a rebuild.
  def self.available?(account_id:)
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      Gotchu::GatewaySecret.for_account(account_id).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # `account_id` is the SESSION's account (`Current.account.id`), never a
  # param: it picks which gateway secret this request sends (see `secret`
  # below, via `Gotchu::GatewaySecret`) and rides along as the
  # `X-Chatwoot-Account-Id` cross-check header the gateway compares against
  # the secret it derived -- so a caller cannot ask this proxy to speak for
  # an account it isn't currently authenticated as.
  def initialize(account_id:)
    @account_id = account_id
  end

  # `refusals` maps an exception class to the status codes THIS call's own
  # gateway route can answer with something other than success — the
  # gateway's handlers vary per route. Any code outside that map, or no answer
  # at all, is UnavailableError: opaque on purpose, so a 403 (credentials
  # rejected) or a 5xx (the gateway's own upstream failure) is never mistaken
  # for a clean business refusal.
  #
  # Takes `**opts` rather than five more named keywords purely to stay under
  # rubocop's Metrics/ParameterLists — every caller still passes named
  # arguments, just gathered into one hash first.
  #
  # `checks_error`, when given, is raised on a 400 with the gateway's checks
  # and its narrowed reason code (see `raise_checks`), instead of the plain
  # `refusals` mapping that would lose them.
  #
  # `conflict_classifier`, when given, is called on a 409 response *before*
  # `refusals` is consulted, and must return the exception class to raise —
  # for a route whose single 409 covers more than one cause. Every other call
  # site leaves it nil and keeps mapping 409 through the plain `refusals`
  # table.
  #
  # Answers the parsed object on a 200 or a 201, and `{}` on a 204, which the
  # create and delete routes answer with.
  def request(verb:, path:, **opts)
    response = perform_http(verb, path, opts.fetch(:query, {}), opts[:body], opts.fetch(:timeout, TIMEOUT_SECONDS))
    return {} if response.code == 204
    return parse(response) if [200, 201].include?(response.code)

    raise_refusal(response, opts)
  rescue *TRANSPORT_ERRORS => e
    # e.class only, never e.message: several of TRANSPORT_ERRORS (SocketError,
    # OpenSSL::SSL::SSLError, ...) build their own message from the request
    # they failed on, including its query string -- which is exactly where
    # the gateway secret lives (`query: { secret: secret }` below). The class
    # name is enough to distinguish a DNS failure from a timeout from a TLS
    # failure without risking that.
    raise UnavailableError, e.class.to_s
  end

  private

  def raise_refusal(response, opts)
    raise_checks(response, opts[:checks_error]) if response.code == 400 && opts[:checks_error]

    classifier = opts[:conflict_classifier]
    raise classifier.call(response), "gateway responded with #{response.code}" if classifier && response.code == 409

    opts.fetch(:refusals, {}).each do |error_class, codes|
      raise error_class, "gateway responded with #{response.code}" if codes.include?(response.code)
    end
    raise UnavailableError, "gateway responded with #{response.code}"
  end

  # The gateway's `error` on a 400 is a machine code, never merchant text. Only
  # the codes a page acts on pass through (spec §11: the composer memo's
  # `scope_required`); anything else reads 'invalid'.
  REASONS_400 = %w[invalid scope_required].freeze

  # A validation refusal carries the save-time checks (spec §10): fixed
  # strings the gateway defines, so they may reach the page. Each one is cut
  # down to the three fields the contract names, so nothing else a 400 body
  # might carry rides along.
  def raise_checks(response, error_class)
    payload = JSON.parse(response.body.to_s)
    payload = {} unless payload.is_a?(Hash)
    reason = REASONS_400.include?(payload['error']) ? payload['error'] : 'invalid'
    checks = Array(payload['checks']).select { |check| check.is_a?(Hash) }.map { |check| check.slice('id', 'ok', 'message') }
    raise error_class.new(checks, reason)
  rescue JSON::ParserError
    raise error_class.new([], 'invalid')
  end

  def perform_http(verb, path, query, body, timeout)
    options = {
      # The panel secret rides in the query string on every route, including
      # the read: the gateway demands it there and the header credential in
      # addition, never instead.
      query: { secret: secret }.merge(query),
      headers: headers(body),
      timeout: timeout,
      # A redirect response would otherwise have HTTParty replay this exact
      # query -- secret included -- against whatever Location header named.
      follow_redirects: false
    }
    options[:body] = body.to_json if body
    HTTParty.public_send(verb, "#{base_url}#{path}", options)
  end

  def headers(body)
    h = {
      # Required on every gesture-guarded route, the reads included — still
      # behind both secrets. Install-level: every account on this install
      # shares the one gesture secret.
      'x-gesture-secret' => gesture_secret,
      # A cross-check only -- the gateway derives the account from the query
      # secret above, never from this header alone. Lets the gateway log and
      # refuse a request whose secret and claimed account disagree, without
      # this proxy needing to know why they might.
      'X-Chatwoot-Account-Id' => @account_id.to_s
    }
    # Not sent on a read: it is a GET with no body, and the gateway does not
    # demand a content type there (server.ts's exception to the write-route
    # content-type rule).
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

  # The calling account's own secret from `GOTCHU_GATEWAY_SECRETS`, or the
  # single `GOTCHU_GATEWAY_SECRET` only while that map is unset -- so a
  # one-account deployment keeps working with no new env var, and an account
  # a set map does not list gets none (`Gotchu::GatewaySecret.for_account`).
  # Raised as the same `ConfigurationError` a missing gateway URL already
  # raises: neither the map nor the fallback naming this account is an
  # operator error, not a request this account's admin can do anything about,
  # and it is raised from inside `perform_http`'s own `query: { secret: secret }`
  # -- before `HTTParty.public_send` runs -- so no request ever reaches the
  # gateway.
  def secret
    @secret ||= Gotchu::GatewaySecret.for_account(@account_id) ||
                raise(ConfigurationError, "no gateway secret is configured for account #{@account_id}")
  end

  def gesture_secret
    @gesture_secret ||= ENV.fetch('GOTCHU_GESTURE_SECRET', nil).presence ||
                        raise(ConfigurationError, 'GOTCHU_GESTURE_SECRET is not set')
  end
end
