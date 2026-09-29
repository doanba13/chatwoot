# Forwards the Gotchu stores screen to the gateway's /api/stores/routes.
#
# Deliberately a sibling of ProcedureService rather than a refactor of it:
# the part the two share (URL, secrets, headers, the HTTParty call) is over
# the ~30 lines the sibling repo's spec allowed for an extraction, and
# ProcedureService is left exactly as it is. Its spec and this one both
# assert the headers, so a drift between the copies fails loudly.
class Gotchu::StoreRoutesService
  class ConfigurationError < StandardError; end
  class UnavailableError < StandardError; end
  class NotFoundError < StandardError; end
  class StoresChangedError < StandardError; end

  # The save the admin submitted would drop a mapped inbox Chatwoot's live
  # list no longer shows (deleted, or invisible to a non-administrator
  # token) without the admin having ticked the confirmation -- the gateway's
  # own unlistedDropped() refused it and named exactly which ids, so this
  # carries them rather than folding into the generic ValidationError body:
  # the screen needs the ids back to re-render its warning, not just "some
  # of this could not be used".
  class UnlistedInboxDroppedError < StandardError
    attr_reader :inbox_ids

    def initialize(inbox_ids)
      @inbox_ids = inbox_ids
      super('gateway refused to drop an inbox the admin has not acknowledged')
    end
  end

  # A PUT answered 500. That can mean the write committed at the gateway
  # (setAccountRoutes returned) and only the registry reload afterwards was
  # refused (storeRoutes.ts's store_routes.reload_refused) -- the row is
  # already in Postgres and the watcher's own poll will pick it up. It can
  # ALSO mean the write itself never happened: a Postgres outage or any other
  # unhandled failure inside the gateway's own request handler hits the same
  # catch-all and answers the same bare 500, with no way for this proxy to
  # tell the two apart (Task 5 fix round 1). Folding this into UnavailableError
  # would say "could not confirm the REQUEST" when a save may well have
  # landed; but this class must not claim the save happened either, since it
  # might not have. See the controller's render_unconfirmed for the wording
  # this lands on.
  class UnconfirmedError < StandardError; end

  # A 400 carries the gateway's reason CODE, never its words, and only a code
  # this build knows. The three are about the caller's own mapping; anything
  # else reads as `invalid`, which is also what a value claimed by another
  # account reads as (the gateway will not say which).
  class ValidationError < StandardError
    REASONS = %w[invalid duplicate one_per_channel].freeze
    attr_reader :reason

    def initialize(reason = 'invalid')
      @reason = REASONS.include?(reason) ? reason : 'invalid'
      super("gateway refused the mapping (#{@reason})")
    end
  end

  # A save is a Chatwoot inbox read, a Postgres transaction and a registry
  # reload on the gateway side -- more than a procedure write, hence not 3s.
  TIMEOUT_SECONDS = 5
  PATH = '/api/stores/routes'.freeze

  TRANSPORT_ERRORS = [
    HTTParty::Error,
    Timeout::Error,
    SocketError,
    SystemCallError,
    OpenSSL::SSL::SSLError,
    EOFError,
    JSON::ParserError
  ].freeze

  def self.available?(account_id:)
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      Gotchu::GatewaySecret.for_account(account_id).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # Both from the SESSION, never from params: the actor is what makes the
  # write attributable, and the account picks the secret this request sends.
  def initialize(actor_id:, account_id:)
    @actor_id = actor_id
    @account_id = account_id
  end

  def list
    request(:get, nil)
  end

  # `stores` is already in the gateway's shape: [{ key:, shopEmails:, inboxIds: }].
  # `acknowledge_removed`, when given, is the mapped-but-invisible inbox ids
  # the admin was shown and chose to drop anyway -- forwarded unchanged as
  # `acknowledgeRemoved`. Left out of the body entirely rather than sent as
  # `[]` when nothing was acknowledged, so a save that never mentions the
  # field looks exactly as it did before the field existed.
  def replace(stores:, acknowledge_removed: nil)
    body = { stores: stores, actor: "chatwoot:#{@actor_id}" }
    body[:acknowledgeRemoved] = acknowledge_removed unless acknowledge_removed.nil?
    request(:put, body)
  end

  private

  def request(verb, body)
    # follow_redirects: false -- the query carries the gateway secret
    # (`query: { secret: secret }` below), and a redirect response would
    # otherwise have HTTParty replay the exact same query, secret included,
    # against whatever Location header the response named.
    options = {
      query: { secret: secret }, headers: headers(body), timeout: TIMEOUT_SECONDS, follow_redirects: false
    }
    options[:body] = body.to_json if body
    response = HTTParty.public_send(verb, "#{base_url}#{PATH}", options)
    return parse(response) if response.code == 200

    raise_for(response, body)
  rescue *TRANSPORT_ERRORS => e
    # e.class only, never e.message: several of TRANSPORT_ERRORS (SocketError,
    # OpenSSL::SSL::SSLError, ...) build their own message from the request
    # they failed on, including its query string -- which is exactly where
    # the gateway secret lives. The class name is enough to distinguish a
    # DNS failure from a timeout from a TLS failure without risking that.
    raise UnavailableError, e.class.to_s
  end

  # A 404 on the list can only mean the gateway surface is dark (the list
  # names no store); on a replace it means a store key was refused. A 500 on
  # the list is plain UnavailableError -- GET never writes anything, so
  # nothing could have landed either way. A 500 on a replace is genuinely
  # ambiguous (see UnconfirmedError's own comment: reload-refused after a
  # real commit, or a write that never happened at all, answer the same bare
  # 500), which is exactly why it gets its own class rather than being folded
  # into either NotFoundError's or UnavailableError's story. `body` here is
  # the OUTGOING request body (nil for GET, present for PUT), reused as the
  # same GET/PUT discriminator the 404 branch already relies on.
  def raise_for(response, body)
    case response.code
    when 400 then raise ValidationError, reason_of(response)
    when 404 then raise(body ? NotFoundError : UnavailableError, 'gateway responded with 404')
    when 409 then raise conflict_error_for(response)
    when 500 then raise(body ? UnconfirmedError : UnavailableError, 'gateway responded with 500')
    else raise UnavailableError, "gateway responded with #{response.code}"
    end
  end

  # Two distinct causes share status 409 (storeRoutes.ts): the store SET
  # changed since the screen loaded (`reason: 'stores_changed'`), or the
  # save would drop a mapped inbox the admin has not acknowledged losing
  # (`error: 'unlisted_inbox_dropped'`, carrying the ids). Anything else -- a
  # shape matching neither, or a body this build cannot even parse -- is
  # opaque and unconfirmed, the same posture ProcedureService's own
  # conflict_error_for takes for a 409 it does not recognise, rather than
  # guessing which of the two known causes it must have been.
  def conflict_error_for(response)
    payload = JSON.parse(response.body.to_s)
    return UnavailableError.new('gateway responded with 409') unless payload.is_a?(Hash)
    return UnlistedInboxDroppedError.new(dropped_ids_of(payload)) if payload['error'] == 'unlisted_inbox_dropped'
    return StoresChangedError.new('gateway responded with 409') if payload['reason'] == 'stores_changed'

    UnavailableError.new('gateway responded with 409')
  rescue JSON::ParserError
    UnavailableError.new('gateway responded with 409')
  end

  def dropped_ids_of(payload)
    ids = payload['inboxIds']
    ids.is_a?(Array) ? ids : []
  end

  def reason_of(response)
    payload = JSON.parse(response.body.to_s)
    payload.is_a?(Hash) ? payload['reason'].to_s : 'invalid'
  rescue JSON::ParserError
    'invalid'
  end

  def headers(body)
    h = { 'x-gesture-secret' => gesture_secret, 'X-Chatwoot-Account-Id' => @account_id.to_s }
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
    @secret ||= Gotchu::GatewaySecret.for_account(@account_id) ||
                raise(ConfigurationError, "no gateway secret is configured for account #{@account_id}")
  end

  def gesture_secret
    @gesture_secret ||= ENV.fetch('GOTCHU_GESTURE_SECRET', nil).presence ||
                        raise(ConfigurationError, 'GOTCHU_GESTURE_SECRET is not set')
  end
end
