class Api::V1::Accounts::Conversations::GotchuThreadsController < Api::V1::Accounts::Conversations::BaseController
  EMPTY = { 'sentDrafts' => [], 'timeline' => [], 'available' => false }.freeze

  def show
    render json: Gotchu::ThreadService.new(conversation: @conversation, account_id: Current.account.id).perform
  rescue Gotchu::GatewayClient::ConfigurationError
    render json: EMPTY
  rescue Gotchu::GatewayClient::UnavailableError => e
    Rails.logger.warn("Gotchu thread read failed for conversation #{@conversation.display_id}: #{e.message}")
    render json: { error: 'Gotchu thread is unavailable', reason: 'unavailable' }, status: :bad_gateway
  end
end
