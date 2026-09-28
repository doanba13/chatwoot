class Api::V1::Accounts::Conversations::AiDraftInstructionsController < Api::V1::Accounts::Conversations::BaseController
  # Telling the agent what to change about its draft. A write, and the only one
  # on this surface: it can produce a note and a new draft version, and it cannot
  # reach a customer. Sending a draft is a separate gesture with separate
  # conditions and is deliberately not here.
  #
  # Authentication, account scoping and `authorize @conversation, :show?` all come
  # from Api::V1::Accounts::Conversations::BaseController — the same three checks
  # the read goes through, so an instruction is only ever forwarded for a
  # conversation Chatwoot would already show this agent. That is one of the three
  # things apps/gateway/src/handlers.ts says the proxy in front of it owes;
  # `Current.user.id` below is the second.

  # The gateway's own cap, aliased rather than copied: a boundary check that
  # drifts from the thing it protects is worse than no boundary check.
  MAX_TEXT_CHARS = Gotchu::InstructService::MAX_TEXT_CHARS

  def create
    invalid = validation_error
    return render json: { error: invalid, reason: 'invalid' }, status: :unprocessable_entity if invalid

    forward_instruction

    # 202, matching what the gateway answered. The instruction is ACCEPTED; what
    # it does happens in the reply worker, which reports to the Lark thread and
    # not here. A 200 would claim an outcome this request cannot observe.
    render json: { status: 'accepted' }, status: :accepted
  rescue Gotchu::InstructService::ConfigurationError => e
    Rails.logger.error("Gotchu instructions are not configured: #{e.message}")
    render json: { error: 'Gotchu instructions are not configured', reason: 'unconfigured' }, status: :service_unavailable
  rescue Gotchu::InstructService::RefusedError => e
    # The status code and the gateway's own words go to the log, never to the
    # response: they name its address and its internals.
    Rails.logger.warn("Gotchu refused an instruction on conversation #{@conversation.display_id}: #{e.message}")
    render json: { error: 'Gotchu did not take that instruction', reason: 'refused' }, status: :conflict
  rescue Gotchu::InstructService::UnavailableError => e
    Rails.logger.warn("Gotchu did not confirm an instruction on conversation #{@conversation.display_id}: #{e.message}")
    render json: { error: 'Gotchu did not confirm the instruction', reason: 'unavailable' }, status: :bad_gateway
  end

  private

  def forward_instruction
    Gotchu::InstructService.new(
      conversation: @conversation,
      # THE SESSION'S user, never `params[:actor_id]`. An actor read off the body
      # is a claim about who pressed the key; this is an identity, and it is the
      # whole of what makes the gesture attributable (invariant 5). A body field
      # by that name is ignored, and there is deliberately no way to override it.
      actor_id: Current.user.id,
      # THE SESSION'S account, for the same reason: it picks which gateway
      # secret this request sends, never a value a caller could name.
      account_id: Current.account.id,
      cycle_id: params[:cycle_id].to_i,
      request_id: params[:request_id].to_s,
      text: instruction_text
    ).perform
  end

  # Trimmed, and the trimmed form is what travels: the gateway rejects text that
  # is blank once trimmed but measures the length of what it was sent, so
  # validating one string and forwarding another is how a boundary check comes to
  # disagree with the thing it is protecting.
  def instruction_text
    @instruction_text ||= params[:text].to_s.strip
  end

  # The first thing wrong with this request, in words the client can act on, or
  # nil. Our own sentences — never the gateway's.
  #
  # Every rule here mirrors one the gateway enforces. The point is not to trust
  # it less; it is that a refusal from the far end arrives as a flat 400 that
  # reads to a supporter as "the draft moved on", which is a different problem
  # with a different fix.
  def validation_error
    return 'cycle_id must be a positive integer' unless params[:cycle_id].to_s.match?(/\A[1-9][0-9]{0,18}\z/)
    return 'request_id must be 8-128 characters of A-Z, a-z, 0-9, _ or -' unless request_id_valid?
    return 'text must not be empty' if instruction_text.empty?
    return "text must be at most #{MAX_TEXT_CHARS} characters" if instruction_text.length > MAX_TEXT_CHARS

    nil
  end

  def request_id_valid?
    params[:request_id].to_s.match?(Gotchu::InstructService::REQUEST_ID_FORMAT)
  end
end
