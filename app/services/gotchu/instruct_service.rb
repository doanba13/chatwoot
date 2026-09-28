class Gotchu::InstructService
  # Raised when the gateway is not configured on this Chatwoot. Its own class,
  # for the reason DraftService gives: a missing env var is an operator error and
  # reporting it as a refusal would send a supporter looking at their draft
  # instead of an operator looking at the deployment.
  class ConfigurationError < StandardError; end

  # Raised for anything the gateway failed to do, or did not answer in time.
  # "Could not confirm", never "did not happen": nothing cancels the gateway's
  # own enqueue, so a timeout here may still have produced an instruction.
  class UnavailableError < StandardError; end

  # Raised when the gateway answered, and answered no. The cycle moved on, the
  # cycle is not this conversation's, or the shape was wrong. A supporter can act
  # on this one — reload and look at the draft — which is why it is not folded
  # into UnavailableError.
  class RefusedError < StandardError; end

  # An instruction is a sentence, and the gateway caps it at 2000 characters
  # (MAX_INSTRUCTION_CHARS in apps/gateway/src/handlers.ts). Mirrored rather than
  # discovered: an over-long instruction refused here is a clean 422 a supporter
  # can act on, where the same text forwarded comes back as an opaque refusal.
  MAX_TEXT_CHARS = 2000

  # The gateway's own REQUEST_ID_RE. No `:` on purpose there — the value lands
  # next to a derived job id — so a client that sends one is refused here rather
  # than at the far end. A v4 UUID satisfies it.
  REQUEST_ID_FORMAT = /\A[A-Za-z0-9_-]{8,128}\z/

  # A gesture is a queue write behind a local hop, and the supporter is waiting
  # on a keypress. Same budget as the read for the same reason.
  TIMEOUT_SECONDS = 3

  # 202, not 200: the gateway accepts the gesture and the worker does the work.
  # Nothing here may ever report more than acceptance.
  ACCEPTED_CODE = 202

  # The gateway answered, and answered no.
  #
  # 400 is a refusal it can explain (a cycle that moved on, a shape it would not
  # take). 404 is deliberately AMBIGUOUS at the far end: it is both "no such
  # cycle, or not this conversation's" and "the write surface is switched off"
  # (`GESTURE_SURFACE` not `proxy`), which handlers.ts makes indistinguishable on
  # purpose so a dark surface cannot be told apart from one that was never built.
  # So it is reported as a refusal in words that fit either — never as a cause
  # nobody observed.
  REFUSED_CODES = [400, 404].freeze

  # Every way the hop can fail without the gateway answering, plus a body that is
  # not what it promised. Same list as the read: Errno::* is SystemCallError, and
  # both timeouts are Timeout::Error.
  TRANSPORT_ERRORS = [
    HTTParty::Error,
    Timeout::Error,
    SocketError,
    SystemCallError,
    OpenSSL::SSL::SSLError,
    EOFError
  ].freeze

  # Whether an instruction can reach the gateway from this deployment, for
  # THIS account. The URL and the gesture secret are install-wide, but the
  # gateway secret is resolved per account (`Gotchu::GatewaySecret.for_account`),
  # so this has to be too -- the same reasoning
  # `ProcedureService.available?` already follows: an account named only in
  # `GOTCHU_GATEWAY_SECRETS`, with no install-wide `GOTCHU_GATEWAY_SECRET`
  # fallback set, is genuinely available even though the single shared
  # variable this used to check is blank. Takes `account_id:` rather than
  # reading `Current.account` itself, for the same reason `initialize` does:
  # a class method has no request context of its own.
  #
  # Read at CALL TIME, never memoized and never a build-time constant: this is
  # what the dashboard's `capabilities.instruct` is computed from, so turning the
  # field on is an env var plus a container restart and never an image rebuild.
  def self.available?(account_id:)
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      Gotchu::GatewaySecret.for_account(account_id).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # `actor_id` is the SESSION's user id, established by the controller from
  # `Current.user` and never read out of the request body. It is what makes the
  # gesture attributable (invariant 5); a body-supplied actor is a claim.
  #
  # `account_id` is likewise the SESSION's account (`Current.account.id`),
  # never a param -- it picks which gateway secret this request sends (see
  # `secret` below, via `Gotchu::GatewaySecret`) and rides along as the
  # `X-Chatwoot-Account-Id` cross-check header the gateway compares against
  # the secret it derived.
  # Six independently required, equally-weighted identity/content fields;
  # none is an "extra option" that could be gathered into an opts hash
  # without hurting readability at the call site (compare
  # ProcedureService#request's `**opts`, which exists for the opposite
  # shape: a few required args plus a genuine long tail of optional ones).
  def initialize(conversation:, actor_id:, cycle_id:, request_id:, text:, account_id:) # rubocop:disable Metrics/ParameterLists
    @conversation = conversation
    @actor_id = actor_id
    @cycle_id = cycle_id
    @request_id = request_id
    @text = text
    @account_id = account_id
  end

  # Returns true when the gateway accepted the gesture. Raises otherwise — there
  # is no third answer, and a nil return would be read as success.
  def perform
    response = post_instruction
    return true if response.code == ACCEPTED_CODE
    raise RefusedError, "gateway refused with #{response.code}" if REFUSED_CODES.include?(response.code)

    raise UnavailableError, "gateway responded with #{response.code}"
  rescue *TRANSPORT_ERRORS => e
    raise UnavailableError, "#{e.class}: #{e.message}"
  end

  private

  def post_instruction
    HTTParty.post(
      "#{base_url}/api/instruct",
      # The panel secret rides in the query string because the surface it was
      # built for cannot send a header. It is not the credential that guards this
      # write — the header below is — and the gateway demands both.
      query: { secret: secret },
      body: payload.to_json,
      headers: {
        # Required by the gateway on the write routes: without it the request is
        # a CORS-simple POST, which is the shape a leaked credential would be
        # fired in from any page.
        'Content-Type' => 'application/json',
        'x-gesture-secret' => gesture_secret,
        # A cross-check only -- the gateway derives the account from the
        # query secret above, never from this header alone.
        'X-Chatwoot-Account-Id' => @account_id.to_s
      },
      timeout: TIMEOUT_SECONDS
    )
  end

  def payload
    {
      # display_id, for the reason DraftService spells out: it is the id the
      # gateway keyed the cycle by, and the one it verifies the cycle against.
      conversationId: @conversation.display_id,
      cycleId: @cycle_id,
      # A STRING of digits. The gateway's AGENT_ID_RE is a string test and a JSON
      # number is refused outright, which would arrive here as a flat 400.
      actorId: @actor_id.to_s,
      requestId: @request_id,
      text: @text
      # No draftVersion, and not because it is unknown: the instruct route
      # REFUSES one. A redraft pins nothing — the draft it produces still has to
      # be reviewed — and a version sent here would make invariant 6 look
      # enforced on a path where it was never in force.
    }
  end

  def base_url
    @base_url ||= ENV.fetch('GOTCHU_GATEWAY_URL', nil).presence&.chomp('/') ||
                  raise(ConfigurationError, 'GOTCHU_GATEWAY_URL is not set')
  end

  # The calling account's own secret when `GOTCHU_GATEWAY_SECRETS` names one,
  # falling back to the single, install-wide `GOTCHU_GATEWAY_SECRET` for any
  # account the map doesn't mention -- so today's one-account deployment
  # keeps working with no new env var at all. Raised before `post_instruction`'s
  # own `HTTParty.post` runs, so no request ever reaches the gateway.
  def secret
    @secret ||= Gotchu::GatewaySecret.for_account(@account_id) ||
                raise(ConfigurationError, "no gateway secret is configured for account #{@account_id}")
  end

  def gesture_secret
    @gesture_secret ||= ENV.fetch('GOTCHU_GESTURE_SECRET', nil).presence ||
                        raise(ConfigurationError, 'GOTCHU_GESTURE_SECRET is not set')
  end
end
