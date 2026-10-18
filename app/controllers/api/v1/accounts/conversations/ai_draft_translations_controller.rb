class Api::V1::Accounts::Conversations::AiDraftTranslationsController < Api::V1::Accounts::Conversations::BaseController
  # Read-only: the translation is for the supporter's eyes. Approval and send
  # keep using the original draft version and never read this (invariant 6).
  #
  # The account comes from the session, never a param. The text is read by the
  # gateway from its own draft row; only the version asked for travels.
  def show
    target = params[:target_language]
    version = Integer(params[:version].to_s, 10, exception: false)
    return render_error('unsupported language') unless Gotchu::TranslateService::TARGETS.include?(target)
    return render_error('invalid version') unless version&.positive?

    result = Gotchu::TranslateService.new(account_id: Current.account.id)
                                     .draft(conversation_id: @conversation.display_id, version: version, target: target)
    return render_error('could not translate') if result.nil?

    render json: { text: result[:text], partial: result[:partial], version: version }
  rescue Gotchu::GatewayClient::ConflictError
    render json: { error: 'stale' }, status: :conflict
  end

  private

  def render_error(message)
    render json: { error: message }, status: :unprocessable_entity
  end
end
