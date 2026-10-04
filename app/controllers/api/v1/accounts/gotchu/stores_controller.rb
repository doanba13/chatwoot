class Api::V1::Accounts::Gotchu::StoresController < Api::V1::Accounts::BaseController
  # Open to every signed-in agent, with no admin check: this is the narrow
  # list behind scope pickers, store dots and the rail (agent-screens plan,
  # decision 7). The store-routes screen, which writes and shows shop
  # addresses, stays administrator-only.

  rescue_from Gotchu::GatewayClient::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::GatewayClient::UnavailableError, with: :render_unavailable

  # A 404 on this list is the dark gateway: `GESTURE_SURFACE` unset makes
  # every Gotchu route 404, and a list has no id to be missing. It renders the
  # same body as an unconfigured gateway, so a page reads "not switched on
  # here", never "you have no stores" or a failure.
  def index
    return render json: unconfigured_body unless Gotchu::GatewayClient.available?(account_id: Current.account.id)

    render json: service.list(allowed_inbox_ids: allowed_inbox_ids).merge('capabilities' => { 'stores' => true })
  rescue Gotchu::GatewayClient::NotFoundError
    render json: unconfigured_body
  end

  private

  def service
    Gotchu::StoreListService.new(account_id: Current.account.id)
  end

  # nil for an administrator (every inbox). Otherwise the agent's own
  # assigned inboxes, the list InboxPolicy::Scope resolves to (spec §11: the
  # inbox lists the fork shows are the fork's to narrow).
  def allowed_inbox_ids
    return nil if Current.account_user&.administrator?

    Current.user.assigned_inboxes.pluck(:id)
  end

  def unconfigured_body
    { 'stores' => [], 'inboxes' => [], 'capabilities' => { 'stores' => false } }
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu store list is not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # The gateway's own words never reach the response, only the log.
  # `params[:account_id]`, not `Current.account.id`: Current is already reset
  # by the time a rescue_from handler runs (ProceduresController says why).
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu store list gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end
end
