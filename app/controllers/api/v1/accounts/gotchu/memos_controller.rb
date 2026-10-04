class Api::V1::Accounts::Gotchu::MemosController < Api::V1::Accounts::BaseController
  # No admin check: every agent may read and write memos (agent-screens plan
  # decision 1), because any supporter can already add one by typing an
  # instruction. What a memo may say is the gateway's save-time checks'.
  #
  # A composer memo names its conversation. The gateway checks only that the
  # conversation is in the account; whether THIS agent may open it is the
  # fork's question (spec §6.5, §11), asked before anything is forwarded.
  before_action :authorize_conversation!, only: %i[create update]

  rescue_from Gotchu::GatewayClient::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::GatewayClient::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::GatewayClient::NotFoundError, with: :render_not_found
  rescue_from Gotchu::GatewayClient::ConflictError, with: :render_changed
  rescue_from Gotchu::MemoService::InvalidError, with: :render_invalid

  UNCONFIGURED_INDEX = { 'memos' => [], 'proposalsPending' => 0, 'capabilities' => { 'memos' => false } }.freeze
  # Strong parameters: text, kind and until as scalars, and the scope's two
  # fields (scope_body); anything else the caller sends never reaches the gateway.
  MEMO_FIELDS = %i[text kind until].freeze

  # Dark (a 404 on the list) and unconfigured read the same: "not switched on
  # here", never "you have no memos".
  def index
    return render(json: UNCONFIGURED_INDEX) unless Gotchu::MemoService.available?(account_id: Current.account.id)

    memos = service.list(store: params[:store], inbox: params[:inbox], include_expired: params[:include] == 'expired')
    render json: memos.merge('memos' => visible_origins(Array(memos['memos'])), 'capabilities' => { 'memos' => true })
  rescue Gotchu::GatewayClient::NotFoundError
    render json: UNCONFIGURED_INDEX
  end

  def create = render(json: visible_origins([service.create(memo: memo_body)]).first)
  def update = render(json: visible_origins([service.update(id: params[:id].to_i, memo: memo_body)]).first)

  def destroy
    service.destroy(id: params[:id].to_i)
    head :no_content
  end

  private

  # A memo's origin keeps its source and author; the conversation it came
  # from is dropped when this user may not open it
  # (Gotchu::VisibleConversations).
  def visible_origins(memos)
    open = Gotchu::VisibleConversations.new(user: Current.user, account: Current.account)
                                       .call(memos.filter_map { |memo| origin_conversation(memo) })
    memos.map do |memo|
      id = origin_conversation(memo)
      id.nil? || open.include?(id) ? memo : memo.merge('origin' => memo['origin'].merge('conversationId' => nil))
    end
  end

  def origin_conversation(memo)
    origin = memo.is_a?(Hash) ? memo['origin'] : nil
    origin.is_a?(Hash) ? origin['conversationId'] : nil
  end

  # The same lookup Conversations::BaseController#conversation makes: a
  # conversation outside the account is a 404 (RecordNotFound), one this agent
  # cannot open a 401 (ConversationPolicy#show?), and neither reaches the
  # gateway.
  def authorize_conversation!
    return if params[:conversation_id].blank?

    @conversation = Current.account.conversations.find_by!(display_id: params[:conversation_id])
    authorize @conversation, :show?
  end

  # A composer memo sends no scope unless the user widened or narrowed it, so
  # the gateway derives the scope from the conversation (spec §6.5). A scope
  # the caller did not send is never invented here either: on the screen path
  # the gateway requires one and says so, and an absent scope must reach it
  # absent, never as all stores. The conversation id is the one authorised
  # above, never read raw from params.
  def memo_body
    fields = params.slice(*MEMO_FIELDS).permit(*MEMO_FIELDS)
    {
      text: fields[:text], kind: fields[:kind], until: fields[:until].presence,
      conversationId: @conversation&.display_id,
      scope: scope_body
    }.compact
  end

  def scope_body
    return nil unless params.key?(:scope)

    scope = params.fetch(:scope, {}).permit(:store_key, :inbox_id)
    return nil if @conversation && scope.blank?

    { storeKey: scope[:store_key].presence, inboxId: scope[:inbox_id].presence&.to_i }
  end

  def service
    @service ||= Gotchu::MemoService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu memos are not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # The gateway's own words never reach the response, only the log.
  # `params[:account_id]`, not `Current.account.id`: Current is reset before a
  # rescue_from handler runs (ProceduresController says why).
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu memos gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  # On the composer path this is also the gateway not finding the
  # conversation in this account.
  def render_not_found(exception)
    Rails.logger.warn("Gotchu found no such memo for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'No such memo', reason: 'not_found' }, status: :not_found
  end

  def render_changed(exception)
    Rails.logger.warn("Gotchu refused a stale memo write for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'The memo changed since you opened it', reason: 'memo_changed' }, status: :conflict
  end

  # `invalid` with the save-time checks, or `scope_required` when a composer
  # memo's conversation has no store to derive a scope from.
  def render_invalid(exception)
    render json: { error: 'Gotchu rejected that memo', reason: exception.reason, checks: exception.checks },
           status: :unprocessable_entity
  end
end
