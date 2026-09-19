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

  # Whether an instruction can reach the gateway from this deployment at all.
  #
  # Three env vars, because the write route demands two credentials: the shared
  # `/api/*` secret in the query string AND `GESTURE_SHARED_SECRET` in the
  # `x-gesture-secret` header. Both server-side only.
  #
  # Read at CALL TIME, never memoized and never a build-time constant: this is
  # what the dashboard's `capabilities.instruct` is computed from, so turning the
  # field on is an env var plus a container restart and never an image rebuild.
  def self.available?
    ENV.fetch('GOTCHU_GATEWAY_URL', nil).present? &&
      ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).present? &&
      ENV.fetch('GOTCHU_GESTURE_SECRET', nil).present?
  end

  # `actor_id` is the SESSION's user id, established by the controller from
  # `Current.user` and never read out of the request body. It is what makes the
  # gesture attributable (invariant 5); a body-supplied actor is a claim.
  def initialize(conversation:, actor_id:, cycle_id:, request_id:, text:)
    @conversation = conversation
    @actor_id = actor_id
    @cycle_id = cycle_id
    @request_id = request_id
    @text = text
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
        'x-gesture-secret' => gesture_secret
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

  def secret
    @secret ||= ENV.fetch('GOTCHU_GATEWAY_SECRET', nil).presence ||
                raise(ConfigurationError, 'GOTCHU_GATEWAY_SECRET is not set')
  end

  def gesture_secret
    @gesture_secret ||= ENV.fetch('GOTCHU_GESTURE_SECRET', nil).presence ||
                        raise(ConfigurationError, 'GOTCHU_GESTURE_SECRET is not set')
  end
end
