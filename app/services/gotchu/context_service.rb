# The order context for the native drawer: one POST to the gateway's
# /api/context. That is a panel read outside the gateway's gesture surface, so
# this does NOT go through Gotchu::GatewayClient -- its headers demand a gesture
# secret, and a desk without one would lose a read that needs none. The call is
# made the way Gotchu::DraftService makes its own.
class Gotchu::ContextService
  class ConfigurationError < StandardError; end
  class UnavailableError < StandardError; end

  # A live 17track read runs a 1/2/3/5 s ladder; 3 s would fail exactly the
  # reads Refresh exists for.
  TIMEOUT_SECONDS = 15

  TRANSPORT_ERRORS = [
    HTTParty::Error,
    Timeout::Error,
    SocketError,
    SystemCallError,
    OpenSSL::SSL::SSLError,
    EOFError,
    JSON::ParserError
  ].freeze

  def initialize(conversation:, account_id:, agent_id:, refresh: false)
    @conversation = conversation
    @account_id = account_id
    @agent_id = agent_id
    @refresh = refresh
  end

  def perform
    response = fetch_context
    raise UnavailableError, "gateway responded with #{response.code}" unless response.success?

    payload = JSON.parse(response.body.to_s)
    raise UnavailableError, "gateway returned #{payload.class} instead of an object" unless payload.is_a?(Hash)

    payload
  rescue *TRANSPORT_ERRORS => e
    # Class only: the message of a transport error can carry the URL, and the
    # query string carries the secret.
    raise UnavailableError, e.class.to_s
  end

  private

  def fetch_context
    HTTParty.post(
      "#{base_url}/api/context",
      query: { secret: secret },
      body: { conversationId: @conversation.display_id, agentId: @agent_id, refresh: @refresh }.to_json,
      headers: {
        'Content-Type' => 'application/json',
        'X-Chatwoot-Account-Id' => @account_id.to_s
      },
      timeout: TIMEOUT_SECONDS,
      follow_redirects: false
    )
  end

  def base_url
    @base_url ||= ENV.fetch('GOTCHU_GATEWAY_URL', nil).presence&.chomp('/') ||
                  raise(ConfigurationError, 'GOTCHU_GATEWAY_URL is not set')
  end

  def secret
    @secret ||= Gotchu::GatewaySecret.for_account(@account_id) ||
                raise(ConfigurationError, "no gateway secret is configured for account #{@account_id}")
  end
end
