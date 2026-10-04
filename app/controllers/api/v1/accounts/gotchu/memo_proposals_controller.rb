class Api::V1::Accounts::Gotchu::MemoProposalsController < Api::V1::Accounts::BaseController
  # The nightly memo proposals (spec §6.4): open to every agent, like memos.
  DECISIONS = %w[confirm dismiss].freeze

  rescue_from Gotchu::GatewayClient::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::GatewayClient::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::GatewayClient::NotFoundError, with: :render_not_found
  rescue_from Gotchu::GatewayClient::ConflictError, with: :render_changed
  rescue_from Gotchu::MemoService::InvalidError, with: :render_invalid

  # A dark gateway's 404 on the list reads as "nothing waiting".
  def index
    return render(json: { 'proposals' => [] }) unless Gotchu::MemoService.available?(account_id: Current.account.id)

    render json: service.proposals
  rescue Gotchu::GatewayClient::NotFoundError
    render json: { 'proposals' => [] }
  end

  def decision
    unless DECISIONS.include?(params[:decision])
      return render json: { error: 'decision must be confirm or dismiss', reason: 'invalid' }, status: :unprocessable_entity
    end

    render json: service.decide(id: params[:id].to_i, decision: params[:decision])
  end

  private

  def service
    @service ||= Gotchu::MemoService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu memo proposals are not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # See MemosController for why the log reads params[:account_id].
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu memo proposals gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_not_found(exception)
    Rails.logger.warn("Gotchu found no such memo proposal for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'No such proposal', reason: 'not_found' }, status: :not_found
  end

  # Someone else confirmed or dismissed it first.
  def render_changed(exception)
    Rails.logger.warn("Gotchu memo proposal already decided for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Someone already decided this proposal', reason: 'already_decided' }, status: :conflict
  end

  def render_invalid(exception)
    render json: { error: 'Gotchu rejected that decision', reason: exception.reason, checks: exception.checks },
           status: :unprocessable_entity
  end
end
