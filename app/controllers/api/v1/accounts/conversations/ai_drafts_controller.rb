class Api::V1::Accounts::Conversations::AiDraftsController < Api::V1::Accounts::Conversations::BaseController
  # Read-only, and it stays that way. Approving or sending a draft are writes that
  # reach a customer: they need their own review and are deliberately not here.
  # Instructing a redraft cannot reach one, and lives in its own controller —
  # AiDraftInstructionsController — rather than turning this one into a write
  # surface.
  #
  # Authentication, account scoping and `authorize @conversation, :show?` all come
  # from Api::V1::Accounts::Conversations::BaseController, so a caller reaches the
  # gateway only for a conversation Chatwoot would already show them.
  def show
    render json: Gotchu::DraftService.new(conversation: @conversation, account_id: Current.account.id).perform.merge('capabilities' => capabilities)
  rescue Gotchu::DraftService::ConfigurationError => e
    Rails.logger.error("AI draft gateway is not configured: #{e.message}")
    render json: { error: 'AI draft service is not configured' }, status: :service_unavailable
  rescue Gotchu::DraftService::UnavailableError => e
    # The detail goes to the log, never to the response: it carries the gateway's
    # own address and status codes.
    Rails.logger.warn("AI draft read failed for conversation #{@conversation.display_id}: #{e.message}")
    render json: { error: 'AI draft service is unavailable' }, status: :bad_gateway
  end

  private

  # Which gestures exist on THIS deployment, answered from server config on every
  # read — not from a constant compiled into the dashboard bundle. That is the
  # point: turning the instruction field on is an env var plus a container
  # restart, never an image rebuild.
  #
  # Only `instruct` is reported, and only the dashboard's instruction field is
  # driven by it. Send, discard, the adjustments and stop stay hidden
  # unconditionally: an instruction can only ever produce a note and a new draft
  # version, a send reaches a customer, and the conditions written for the send
  # path are not these.
  #
  # It says the credentials are in place, which is all this process can know. The
  # gateway's own `GESTURE_SURFACE` kill switch is behind another host and answers
  # 404 either way (see InstructService::REFUSED_CODES), so a press against a dark
  # surface is reported as a refusal rather than as a capability that lied.
  def capabilities
    { 'instruct' => Gotchu::InstructService.available?(account_id: Current.account.id) }
  end
end
