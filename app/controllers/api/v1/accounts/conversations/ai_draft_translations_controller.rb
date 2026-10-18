class Api::V1::Accounts::Conversations::AiDraftTranslationsController < Api::V1::Accounts::Conversations::BaseController
  # Read-only: the translation is for the supporter's eyes. Approval and send
  # keep using the original draft version and never read this (invariant 6).
  #
  # The account comes from the session, never a param. The text is read by the
  # gateway from its own draft row; only the cycle and version asked for travel,
  # because a version number is only unique within its cycle.
  def show
    error = param_error
    return render_error(error) if error

    result = Gotchu::TranslateService.new(account_id: Current.account.id).draft(
      conversation_id: @conversation.display_id, cycle_id: positive(:cycle_id),
      version: positive(:version), target: params[:target_language]
    )
    return render_error('could not translate') if result.nil?

    render json: { text: result[:text], partial: result[:partial], version: positive(:version), cycle_id: positive(:cycle_id) }
  rescue Gotchu::GatewayClient::ConflictError
    render json: { error: 'stale' }, status: :conflict
  end

  private

  def param_error
    return 'unsupported language' unless Gotchu::TranslateService::TARGETS.include?(params[:target_language])
    return 'invalid version' unless positive(:version)

    'invalid cycle' unless positive(:cycle_id)
  end

  def positive(key)
    value = Integer(params[key].to_s, 10, exception: false)
    value if value&.positive?
  end

  def render_error(message)
    render json: { error: message }, status: :unprocessable_entity
  end
end
