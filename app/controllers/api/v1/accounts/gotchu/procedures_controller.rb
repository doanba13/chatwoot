class Api::V1::Accounts::Gotchu::ProceduresController < Api::V1::Accounts::BaseController
  # Procedures are merchant-authored config that applies across a store's
  # conversations, not a per-conversation gesture — so this is account-level,
  # not nested under conversations the way AiDraftsController/
  # AiDraftInstructionsController are.
  #
  # Administrators only, via the MIT-core check (`Current.account_user.
  # administrator?`) — not Chatwoot's custom roles, which live under
  # enterprise/ and carry a licence decision that is deliberately not being
  # taken here.
  before_action :check_admin_authorization?

  rescue_from Gotchu::ProcedureService::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::ProcedureService::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::ProcedureService::ValidationError, with: :render_invalid
  rescue_from Gotchu::ProcedureService::ConflictError, with: :render_conflict
  rescue_from Gotchu::ProcedureService::NotFoundError, with: :render_not_found

  # The one read on this surface, and the one action that checks `available?`
  # itself rather than letting ConfigurationError reach the rescue above: an
  # unconfigured gateway must let the settings screen render an honest "not
  # configured" state, the way AiDraftsController already reports
  # `capabilities.instruct` — never fail the whole screen the way a 503 would.
  def index
    if Gotchu::ProcedureService.available?
      render json: service.list(store: params[:store]).merge('capabilities' => capabilities)
    else
      render json: { 'procedures' => [], 'capabilities' => capabilities }
    end
  end

  # Always created at status 'testing'; the gateway ignores anything else
  # sent under that key, and this controller offers no field for one.
  def create
    render json: service.create(
      slug: params[:slug],
      title: params[:title],
      text: params[:body],
      phrases: params[:phrases],
      store_key: params[:store_key]
    )
  end

  # A new version. The slug is identity and never travels here — the gateway
  # carries the existing row's slug over regardless.
  def update
    render json: service.revise(
      id: params[:id].to_i,
      title: params[:title],
      text: params[:body],
      phrases: params[:phrases]
    )
  end

  def status
    render json: service.set_status(id: params[:id].to_i, status: params[:status])
  end

  # Match counts over the last N days, scored over the whole procedure set.
  def replay
    render json: service.replay(
      days: params[:days],
      store_key: params[:store_key],
      procedure_id: params[:procedure_id]
    )
  end

  private

  def service
    @service ||= Gotchu::ProcedureService.new(actor_id: Current.user.id)
  end

  # Server config, answered per read — the same reason AiDraftsController's
  # own `capabilities` is: turning the screen on is an env var and a
  # container restart, never a dashboard rebuild.
  def capabilities
    { 'procedures' => Gotchu::ProcedureService.available? }
  end

  def render_unconfigured(exception)
    Rails.logger.error("Gotchu procedures are not configured: #{exception.message}")
    render json: { error: 'Gotchu procedures are not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  # The gateway's own words never reach the response, only the log — they
  # name its address and status codes, the same restraint InstructService's
  # own RefusedError/UnavailableError apply.
  #
  # `params[:account_id]`, not `Current.account.id`: ApplicationController's
  # own `handle_with_exception` around_action resets `Current` in its
  # `ensure` clause on the way out, which runs before an exception this
  # controller's own `rescue_from` handles ever reaches its handler method —
  # so `Current.account` is already nil by the time any of the five methods
  # below run.
  def render_unavailable(exception)
    Rails.logger.warn("Gotchu procedure gateway did not confirm a request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_invalid(exception)
    Rails.logger.warn("Gotchu rejected a procedure request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu rejected that procedure', reason: 'invalid' }, status: :unprocessable_entity
  end

  def render_conflict(exception)
    Rails.logger.warn("Gotchu refused a duplicate procedure slug for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'A procedure with that slug already exists for this store', reason: 'duplicate_slug' }, status: :conflict
  end

  def render_not_found(exception)
    Rails.logger.warn("Gotchu found no such procedure for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'No such procedure', reason: 'not_found' }, status: :not_found
  end
end
