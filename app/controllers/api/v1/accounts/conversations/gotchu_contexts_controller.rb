class Api::V1::Accounts::Conversations::GotchuContextsController < Api::V1::Accounts::Conversations::BaseController
  def show
    render json: Gotchu::ContextService.new(
      conversation: @conversation, account_id: Current.account.id, agent_id: Current.user.id,
      refresh: ActiveModel::Type::Boolean.new.cast(params[:refresh]) == true
    ).perform
  rescue Gotchu::ContextService::ConfigurationError
    render json: { error: 'Order lookup is not configured', reason: 'unconfigured' }, status: :service_unavailable
  rescue Gotchu::ContextService::UnavailableError => e
    # Display id only: the payload carries customer PII.
    Rails.logger.warn("Gotchu context read failed for conversation #{@conversation.display_id}: #{e.message}")
    render json: { error: 'Order lookup is unavailable', reason: 'unavailable' }, status: :bad_gateway
  end
end
