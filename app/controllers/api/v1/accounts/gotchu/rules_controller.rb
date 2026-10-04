class Api::V1::Accounts::Gotchu::RulesController < Api::V1::Accounts::BaseController
  # Every signed-in agent reads rules; writes, the save-time check and the
  # replay are administrators only (agent-screens plan decision 1). The
  # editor's write mode is the only caller of check and replay, and only an
  # administrator sees it.
  READ_ACTIONS = %i[index show].freeze
  before_action :check_admin_authorization?, except: READ_ACTIONS

  rescue_from Gotchu::GatewayClient::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::GatewayClient::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::GatewayClient::NotFoundError, with: :render_not_found
  rescue_from Gotchu::GatewayClient::ConflictError, with: :render_changed
  rescue_from Gotchu::RuleService::InvalidError, with: :render_invalid

  UNCONFIGURED_INDEX = { 'rules' => [], 'facts' => [], 'capabilities' => { 'rules' => false } }.freeze
  # Only the rule's own scalar fields and the condition document's SHAPE,
  # { v, all: [{ fact, op, value }] } with a value that is a list of words, a
  # number or a yes/no, reach the gateway.
  RULE_FIELDS = %i[title say sending].freeze
  CONDITION_FIELDS = [:fact, :op, :value, { value: [] }].freeze

  # Dark (a 404 on the list) and unconfigured read the same: "not switched on
  # here", never "you have no rules".
  def index
    return render(json: UNCONFIGURED_INDEX) unless Gotchu::RuleService.available?(account_id: Current.account.id)

    render json: service.list(store: params[:store], inbox: params[:inbox], status: params[:status])
                        .merge('capabilities' => { 'rules' => true })
  rescue Gotchu::GatewayClient::NotFoundError
    render json: UNCONFIGURED_INDEX
  end

  def show = render(json: service.show(id: params[:id].to_i))

  # 201 RuleView, status `testing`.
  def create = render(json: service.create(rule: rule_body), status: :created)

  # `{ rule, demoted }`, passed through whole: a revision of an active rule
  # demotes too, so Rails never unwraps `rule` and drops `demoted`.
  def update
    render json: service.revise(id: params[:id].to_i, rule: rule_body, expected_version: params[:expected_version].to_i)
  end

  def status
    render json: service.set_status(id: params[:id].to_i, status: params[:status], expected_version: params[:expected_version].to_i)
  end

  def check = render(json: service.check(rule: rule_body))

  # The matched conversations are narrowed to the ones this user may open
  # (Gotchu::VisibleConversations); the counts stay the gateway's.
  def replay
    result = service.replay(rule: rule_body, days: params[:days], rule_id: params[:rule_id])
    return render(json: result) unless result.is_a?(Hash) && result.key?('conversationIds')

    ids = Gotchu::VisibleConversations.new(user: Current.user, account: Current.account).filter(result['conversationIds'])
    render json: result.merge('conversationIds' => ids)
  end

  private

  # Strong parameters (RULE_FIELDS, CONDITION_FIELDS). Which facts, operators
  # and values are allowed is the gateway's to validate against its own fact
  # registry; Rails does not keep a second copy of that vocabulary. The actor
  # is added by the service from the session, never read from params.
  def rule_body
    fields = params.slice(*RULE_FIELDS).permit(*RULE_FIELDS)
    scope = params.fetch(:scope, {}).permit(:store_key, :inbox_id, except_inbox_ids: [])
    {
      title: fields[:title],
      say: fields[:say].presence,
      sending: fields[:sending],
      conditions: conditions_body,
      scope: { storeKey: scope[:store_key].presence, inboxId: scope[:inbox_id].presence&.to_i,
               exceptInboxIds: Array(scope[:except_inbox_ids]).map(&:to_i) }
    }
  end

  def conditions_body
    raw = params[:conditions]
    return nil unless raw.is_a?(ActionController::Parameters)

    raw.permit(:v, all: CONDITION_FIELDS).to_h
  end

  # See ProceduresController#check_admin_authorization? for the safe
  # navigation: an agent-bot token carries no account_user.
  def check_admin_authorization?
    raise Pundit::NotAuthorizedError unless Current.account_user&.administrator?
  end

  def service
    @service ||= Gotchu::RuleService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu rules are not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # The gateway's own words never reach the response, only the log.
  # `params[:account_id]`, not `Current.account.id`: Current is reset before a
  # rescue_from handler runs (ProceduresController says why).
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu rules gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_not_found(exception)
    Rails.logger.warn("Gotchu found no such rule for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'No such rule', reason: 'not_found' }, status: :not_found
  end

  def render_changed(exception)
    Rails.logger.warn("Gotchu refused a stale rule write for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'The rule changed since you opened it', reason: 'rule_changed' }, status: :conflict
  end

  # The checks pass through: their messages are the fixed strings of spec §10.
  def render_invalid(exception)
    render json: { error: 'Gotchu rejected that rule', reason: exception.reason, checks: exception.checks },
           status: :unprocessable_entity
  end
end
