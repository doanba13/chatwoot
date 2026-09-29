# Forwards the Gotchu stores screen's Shopify section to the gateway's
# /api/shopify/* routes (item 6.4).
#
# A sibling of StoreRoutesService and ProcedureService rather than a shared
# base, for the reason StoreRoutesService gives: the copies assert the same
# headers, so drift between them fails loudly. The hardening below is that
# service's, verbatim in intent (6.3 A13).
class Gotchu::ShopifyService
  class ConfigurationError < StandardError; end
  class UnavailableError < StandardError; end
  class NotFoundError < StandardError; end
  class PrefixTakenError < StandardError; end
  # The gateway throttles Shopify writes per account. Its own class: the
  # admin's fix is to wait, not to reload.
  class TooManySavesError < StandardError; end

  # A 400 carries the gateway's reason CODE, never its words, and only a code
  # the call in question can be caused by. Anything else on a 400 (for
  # example `actor is required`) is not something the admin did, so it is
  # UnavailableError instead.
  class ValidationError < StandardError
    attr_reader :reason

    def initialize(reason)
      @reason = reason
      super("gateway refused the request (#{reason})")
    end
  end

  # Shopify's return could not be turned into a connected store. The gateway
  # keeps the cause to itself and hands back a reference to quote; this
  # carries only that reference, and only when it is shaped like the id the
  # gateway makes, so gateway free text never reaches a browser.
  class InstallFailedError < StandardError
    REFERENCE = /\A[0-9a-f-]{8,64}\z/i

    attr_reader :reference

    def initialize(reference)
      @reference = reference.is_a?(String) && REFERENCE.match?(reference) ? reference : nil
      super('gateway could not complete the install')
    end
  end

  TIMEOUT_SECONDS = 3
  # Completing an install exchanges a code with Shopify, reads the shop and
  # registers a webhook: longer than a plain read or write.
  COMPLETE_TIMEOUT_SECONDS = 15
  TRANSPORT_ERRORS = [HTTParty::Error, Timeout::Error, SocketError, SystemCallError, OpenSSL::SSL::SSLError, EOFError,
                      JSON::ParserError].freeze
  # The one place a browser is sent off-site. Even a compromised gateway must
  # not turn this into an open redirect.
  SHOPIFY_HOST = /\A[a-z0-9][a-z0-9-]*\.myshopify\.com\z/

  def self.available?(account_id:)
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      Gotchu::GatewaySecret.for_account(account_id).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # Both from the SESSION, never from params.
  def initialize(actor_id:, account_id:)
    @actor_id = actor_id
    @account_id = account_id
  end

  def install(shop:)
    payload = request(verb: :post, path: '/api/shopify/install', body: { shop: shop, actor: actor },
                      validation: %w[invalid_shop], not_found: UnavailableError)
    url = URI.parse(payload['authorizeUrl'].to_s)
    raise UnavailableError, 'gateway returned a non-Shopify authorize URL' unless shopify_url?(url)

    { 'authorizeUrl' => url.to_s }
  rescue URI::InvalidURIError
    raise UnavailableError, 'gateway returned an unparseable authorize URL'
  end

  # `query` is Shopify's callback query, as one string, exactly as the stores
  # page received it (minus the fork's own marker). The gateway verifies its
  # HMAC and spends the install state; this proxy only adds who is asking.
  def complete(query:)
    request(verb: :post, path: '/api/shopify/complete', body: { query: query, actor: actor },
            validation: %w[invalid_query], not_found: UnavailableError, timeout: COMPLETE_TIMEOUT_SECONDS,
            install_failed: true)
  end

  # A 404 here can only mean the Shopify app is dark on the gateway (the list
  # names no store), so it is NotFoundError for the controller to read as a
  # capability, not a failure.
  def stores
    request(verb: :get, path: '/api/shopify/stores', not_found: NotFoundError)
  end

  def update_prefix(store_key:, order_prefix:)
    request(verb: :put, path: "/api/shopify/stores/#{store_key}/prefix", body: { orderPrefix: order_prefix, actor: actor },
            validation: %w[invalid_prefix], not_found: NotFoundError)
  end

  private

  def actor
    "chatwoot:#{@actor_id}"
  end

  def shopify_url?(url)
    url.scheme == 'https' && url.userinfo.nil? && SHOPIFY_HOST.match?(url.host.to_s)
  end

  # `rules` is how a non-200 is read for this call: `not_found` (the class a
  # 404 raises), `validation` (the 400 codes the caller can have caused),
  # `install_failed`, and `timeout`.
  def request(verb:, path:, body: nil, **rules)
    # follow_redirects: false -- the query carries the gateway secret, and a
    # redirect response would otherwise have HTTParty replay it, secret
    # included, against whatever Location header the response named.
    options = { query: { secret: secret }, headers: headers(body), timeout: rules.fetch(:timeout, TIMEOUT_SECONDS),
                follow_redirects: false }
    options[:body] = body.to_json if body
    response = HTTParty.public_send(verb, "#{base_url}#{path}", options)
    return parse(response) if response.code == 200

    raise_for(response, rules)
  rescue *TRANSPORT_ERRORS => e
    # e.class only, never e.message: several of TRANSPORT_ERRORS build their
    # message from the request they failed on, query string (the secret)
    # included.
    raise UnavailableError, e.class.to_s
  end

  def raise_for(response, rules)
    case response.code
    when 400 then raise_bad_request(response, rules)
    when 404 then raise rules.fetch(:not_found), 'gateway responded with 404'
    when 409 then raise PrefixTakenError, 'gateway responded with 409'
    when 429 then raise TooManySavesError, 'gateway responded with 429'
    else raise UnavailableError, "gateway responded with #{response.code}"
    end
  end

  def raise_bad_request(response, rules)
    payload = error_payload(response)
    error = payload['error']
    raise InstallFailedError, payload['reference'] if rules[:install_failed] && error == 'install_failed'
    raise ValidationError, error if rules.fetch(:validation, []).include?(error)

    raise UnavailableError, 'gateway responded with 400'
  end

  def error_payload(response)
    payload = JSON.parse(response.body.to_s)
    payload.is_a?(Hash) ? payload : {}
  rescue JSON::ParserError
    {}
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
