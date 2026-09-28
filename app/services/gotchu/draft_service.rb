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

  # `account_id` is the SESSION's account (`Current.account.id`), never a
  # param -- it picks which gateway secret this request sends (see `secret`
  # below, via `Gotchu::GatewaySecret`) and rides along as the
  # `X-Chatwoot-Account-Id` cross-check header the gateway compares against
  # the secret it derived. `@conversation` is already scoped to this same
  # account by the controller's own `Current.account.conversations.find_by!`,
  # so the two can never disagree.
  def initialize(conversation:, account_id:)
    @conversation = conversation
    @account_id = account_id
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
      headers: {
        'Content-Type' => 'application/json',
        # A cross-check only -- the gateway derives the account from the
        # query secret above, never from this header alone.
        'X-Chatwoot-Account-Id' => @account_id.to_s
      },
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

  # The calling account's own secret from `GOTCHU_GATEWAY_SECRETS`, or the
  # single `GOTCHU_GATEWAY_SECRET` only while that map is unset -- so today's
  # one-account deployment keeps working with no new env var, and an account
  # a set map does not list gets none (`Gotchu::GatewaySecret.for_account`). Raised before `fetch_draft`'s
  # own `HTTParty.post` runs, so no request ever reaches the gateway.
  def secret
    @secret ||= Gotchu::GatewaySecret.for_account(@account_id) ||
                raise(ConfigurationError, "no gateway secret is configured for account #{@account_id}")
  end
end
