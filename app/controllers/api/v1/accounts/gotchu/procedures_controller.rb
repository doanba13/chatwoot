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

  # 'off' is deliberately absent: off is the absence of a binding row, never
  # a tier value (global constraint) -- so `update_binding` maps a blank
  # `params[:tier]` to `nil`, not to a fourth string here.
  ALLOWED_TIERS = %w[draft auto].freeze

  rescue_from Gotchu::ProcedureService::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::ProcedureService::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::ProcedureService::ValidationError, with: :render_invalid
  rescue_from Gotchu::ProcedureService::ConflictError, with: :render_conflict
  rescue_from Gotchu::ProcedureService::NotFoundError, with: :render_not_found
  # Registered AFTER the generic ConflictError above, on purpose: Rails'
  # rescue_from resolves the handler registered LAST among every one that
  # matches an exception's ancestry, and both of these are ConflictError
  # subclasses (Gotchu::ProcedureService), so registering them first would
  # let the generic "duplicate slug" handler answer a stale-version or
  # not-active-for-auto binding conflict instead of its own, more useful,
  # message.
  rescue_from Gotchu::ProcedureService::StaleVersionError, with: :render_stale_version
  rescue_from Gotchu::ProcedureService::NotActiveForAutoError, with: :render_not_active_for_auto

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

  # One row per channel currently bound; a channel absent from the array is
  # off (global constraint: off is the absence of a binding row, never a
  # tier value), so this action never has an "empty" case to special-case.
  def bindings
    render json: service.bindings(id: params[:id].to_i)
  end

  # `params[:tier]` is 'draft' | 'auto' | blank (blank means "off", sent to
  # the gateway as an explicit `tier: null`). Anything else is rejected here
  # rather than forwarded, so a typo never reaches the gateway as a request
  # it also has to validate.
  #
  # `params[:expected_version]` is read under that one name only -- never
  # `params[:version]` and never `params[:authorised_version]` -- and passed
  # straight through as the service's `expected_version:` precondition. The
  # gateway itself derives and stamps the procedure's authorised version; no
  # input on this surface can set one (sibling repo invariant 36).
  def update_binding
    tier = params[:tier].presence
    if tier && ALLOWED_TIERS.exclude?(tier)
      render json: { error: 'tier must be one of: draft, auto, or absent/null for off', reason: 'invalid' },
             status: :unprocessable_entity
      return
    end

    render json: service.set_binding(
      id: params[:id].to_i,
      channel: params[:channel],
      tier: tier,
      expected_version: params[:expected_version].presence&.to_i
    )
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

  def render_stale_version(exception)
    Rails.logger.warn("Gotchu refused a binding write because the procedure changed for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'The procedure changed since you opened it. Reload and try again.', reason: 'stale_version' },
           status: :conflict
  end

  def render_not_active_for_auto(exception)
    Rails.logger.warn("Gotchu refused raising a channel to auto on a non-active procedure for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Only an active procedure can be raised to auto.', reason: 'not_active_for_auto' },
           status: :conflict
  end
end
