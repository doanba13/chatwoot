class Api::V1::Accounts::Gotchu::AgentController < Api::V1::Accounts::BaseController
  # No admin check: every agent reads the overview, and every agent may stop
  # an auto send they can see, because stopping is the safe direction
  # (agent-screens plan decision 1). Nothing here decides anything about
  # sending; the Stop is a gesture forwarded with the session's actor.
  #
  # The gateway answers account-wide and has no idea which user asked, so the
  # conversation ids it returns are narrowed here to the ones this user may
  # open (Gotchu::VisibleConversations), and a Stop names its conversation and
  # is refused unless this user may open it (the fix-wave contract).

  rescue_from Gotchu::GatewayClient::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::GatewayClient::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::GatewayClient::NotFoundError, with: :render_not_found
  rescue_from Gotchu::GatewayClient::ConflictError, with: :render_not_holding

  UNCONFIGURED = { 'capabilities' => { 'overview' => false } }.freeze

  # Dark (a 404) and unconfigured read the same: "not switched on here".
  def overview
    return render(json: UNCONFIGURED) unless Gotchu::AgentService.available?(account_id: Current.account.id)

    render json: visible(service.overview(days: params[:days].presence&.to_i)).merge('capabilities' => { 'overview' => true })
  rescue Gotchu::GatewayClient::NotFoundError
    render json: UNCONFIGURED
  end

  # The same lookup MemosController makes: a conversation outside the account
  # is a 404 (RecordNotFound), one this user cannot open a 401
  # (ConversationPolicy#show?), and neither reaches the gateway. The gateway
  # then refuses a cycle that is not this conversation's.
  def stop_auto
    if params[:conversation_id].blank?
      return render json: { error: 'A Stop names its conversation', reason: 'invalid' }, status: :unprocessable_entity
    end

    conversation = Current.account.conversations.find_by!(display_id: params[:conversation_id])
    authorize conversation, :show?
    render json: service.stop_auto(cycle_id: params[:id].to_i, conversation_id: conversation.display_id)
  end

  private

  # Holds and unmatched conversations this user may not open are dropped;
  # every count stays the gateway's.
  def visible(overview)
    holds = Array(overview['holding'])
    no_match = overview['noMatch']
    ids = holds.pluck('conversationId') + Array(no_match&.dig('conversationIds'))
    open = Gotchu::VisibleConversations.new(user: Current.user, account: Current.account).call(ids)
    narrowed = overview.merge('holding' => holds.select { |hold| open.include?(hold['conversationId']) })
    return narrowed unless no_match.is_a?(Hash)

    narrowed.merge('noMatch' => no_match.merge('conversationIds' => Array(no_match['conversationIds']).select { |id| open.include?(id) }))
  end

  def service
    @service ||= Gotchu::AgentService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu agent overview is not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # The gateway's own words never reach the response, only the log.
  # `params[:account_id]`, not `Current.account.id`: Current is reset before a
  # rescue_from handler runs (ProceduresController says why).
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu agent gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_not_found(exception)
    Rails.logger.warn("Gotchu found no such cycle for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'No such conversation draft', reason: 'not_found' }, status: :not_found
  end

  # Spec §9.6: the release or another person's Stop won. Never "stopped".
  def render_not_holding(exception)
    Rails.logger.info("Gotchu auto send was no longer holding for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'This send is no longer waiting', reason: 'not_holding' }, status: :conflict
  end
end
