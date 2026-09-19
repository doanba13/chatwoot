class Gotchu::DraftService
  # Raised when the gateway is not configured. Deliberately a different class
  # from a transport failure: a missing env var is an operator error and has to
  # be reported as one. Reporting it as an empty draft would be indistinguishable
  # from "the worker has not drafted for this conversation", which is the one
  # answer an unconfigured deployment must never give.
  class ConfigurationError < StandardError; end

  # Raised for anything the gateway itself did, or failed to do, in time.
  class UnavailableError < StandardError; end

  # A draft is an enrichment over a dashboard that works fine without one, so a
  # slow or dead gateway must never hold a dashboard request open. Short on
  # purpose: the gateway answers from a database read behind a local hop.
  TIMEOUT_SECONDS = 3

  # Every way the hop to the gateway can fail without the gateway answering,
  # plus a body that is not the JSON it promised. Errno::* is covered by
  # SystemCallError, and both Net::OpenTimeout and Net::ReadTimeout by
  # Timeout::Error.
  TRANSPORT_ERRORS = [
    HTTParty::Error,
    Timeout::Error,
    SocketError,
    SystemCallError,
    OpenSSL::SSL::SSLError,
    EOFError,
    JSON::ParserError
  ].freeze

  def initialize(conversation:)
    @conversation = conversation
  end

  # Returns the gateway's payload: { 'cycle' => {...} | nil, 'draft' => {...} | nil }
  def perform
    response = fetch_draft
    raise UnavailableError, "gateway responded with #{response.code}" unless response.success?

    payload = JSON.parse(response.body.to_s)
    raise UnavailableError, "gateway returned #{payload.class} instead of an object" unless payload.is_a?(Hash)

    payload
  rescue *TRANSPORT_ERRORS => e
    raise UnavailableError, "#{e.class}: #{e.message}"
  end

  private

  def fetch_draft
    HTTParty.post(
      "#{base_url}/api/draft",
      # The gateway cannot read a custom header on the surface this secret was
      # built for, so it takes it in the query string. That is acceptable for a
      # read and explicitly not for a write; this class only ever reads, and the
      # secret never leaves this process.
      query: { secret: secret },
      body: { conversationId: gateway_conversation_id }.to_json,
      headers: { 'Content-Type' => 'application/json' },
      timeout: TIMEOUT_SECONDS
    )
  end

  # display_id, not id. The gateway keys every reply cycle by the conversation id
  # that arrives in Chatwoot's own outgoing webhook payload, and that field is
  # display_id: Conversations::EventDataPresenter#push_data renders
  # `id: display_id`, and Message#push_event_data renders
  # `conversation_id: display_id`. It is also the value Chatwoot's own REST routes
  # resolve (`find_by!(display_id: params[:id])`) and the one dashboard URLs
  # carry, which is why the gateway can read a conversation back with what it
  # stored. Sending Conversation#id would ask for another conversation's draft.
  def gateway_conversation_id
    @conversation.display_id
  end

  def base_url
    @base_url ||= ENV.fetch('GOTCHU_GATEWAY_URL', nil).presence&.chomp('/') ||
                  raise(ConfigurationError, 'GOTCHU_GATEWAY_URL is not set')
  end

  def secret
    @secret ||= ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).presence ||
                raise(ConfigurationError, 'GOTCHU_GATEWAY_SECRET is not set')
  end
end
