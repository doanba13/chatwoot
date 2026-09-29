class Api::V1::Accounts::Gotchu::StoreRoutesController < Api::V1::Accounts::BaseController
  # Which inbox is which shop. Administrators only, via the MIT-core check,
  # for the reason ProceduresController gives. The gateway validates every
  # store key, inbox id and address against this account; this proxy's job
  # is the session -- who is asking, and for which account.
  before_action :check_admin_authorization?

  rescue_from Gotchu::StoreRoutesService::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::StoreRoutesService::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::StoreRoutesService::ValidationError, with: :render_invalid
  rescue_from Gotchu::StoreRoutesService::NotFoundError, with: :render_not_found
  rescue_from Gotchu::StoreRoutesService::StoresChangedError, with: :render_stores_changed
  rescue_from Gotchu::StoreRoutesService::UnlistedInboxDroppedError, with: :render_unlisted_inbox_dropped
  rescue_from Gotchu::StoreRoutesService::UnconfirmedError, with: :render_unconfirmed
  rescue_from Gotchu::StoreRoutesService::TooManySavesError, with: :render_too_many_saves

  def index
    if Gotchu::StoreRoutesService.available?(account_id: Current.account.id)
      render json: service.list.merge('capabilities' => capabilities)
    else
      render json: { 'stores' => [], 'inboxes' => [], 'capabilities' => capabilities }
    end
  end

  # Only key, shop_emails, inbox_ids and acknowledge_removed are read. A
  # channel, an actor or an account id in the body never travels: the
  # channel is Chatwoot's (the gateway reads it), and the other two come
  # from the session.
  def update
    stores = stores_param
    if stores.nil?
      render json: { error: 'stores must be a list of stores', reason: 'invalid' }, status: :unprocessable_entity
      return
    end

    render json: service.replace(stores: stores, acknowledge_removed: acknowledge_removed_param)
  end

  private

  # Api::BaseController's own check calls `Current.account_user.administrator?`
  # and raises NoMethodError -- a 500 -- when no account_user is set, which is
  # what an agent-bot token carries. Chatwoot's validate_bot_access_token!
  # refuses bots on this controller before this runs today; the safe
  # navigation keeps this check correct on its own rather than by that
  # ordering (security review L2, final 6.3). Overridden here, not upstream,
  # so the fork's core files stay as Chatwoot ships them.
  def check_admin_authorization?
    raise Pundit::NotAuthorizedError unless Current.account_user&.administrator?
  end

  def stores_param
    raw = params[:stores]
    return nil unless raw.is_a?(Array) && raw.all?(ActionController::Parameters)

    raw.map do |entry|
      store = entry.permit(:key, shop_emails: [], inbox_ids: [])
      { key: store[:key], shopEmails: Array(store[:shop_emails]), inboxIds: Array(store[:inbox_ids]) }
    end
  end

  # Mapped-but-invisible inbox ids the admin was shown and chose to drop
  # anyway. `permit(acknowledge_removed: [])` is what makes this a scalar
  # array or nothing: a Hash or any other non-Array shape under this key is
  # filtered out by strong parameters rather than coerced by `Array(...)`,
  # which would otherwise wrap a stray Hash into a one-element array and
  # forward it. `nil` (absent, or filtered out) lets StoreRoutesService tell
  # "nothing to acknowledge" apart from "acknowledged nothing", so the
  # gateway body carries no `acknowledgeRemoved` key for a save that never
  # mentioned one. Elementwise validation (positive integers) is left to the
  # gateway's own schema, the same posture `stores_param` already takes for
  # `inbox_ids`.
  def acknowledge_removed_param
    params.permit(acknowledge_removed: [])[:acknowledge_removed]
  end

  def service
    @service ||= Gotchu::StoreRoutesService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def capabilities
    { 'store_routes' => Gotchu::StoreRoutesService.available?(account_id: Current.account.id) }
  end

  # `params[:account_id]`, not `Current.account.id`, in every handler below:
  # Current is already reset by the time a rescue_from handler runs (see
  # ProceduresController for the full reasoning).
  def render_unconfigured(exception)
    Rails.logger.error("Gotchu store routes are not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  def render_unavailable(exception)
    Rails.logger.warn("Gotchu gateway did not confirm a store-routes request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_invalid(exception)
    Rails.logger.warn("Gotchu refused a store mapping for account #{params[:account_id]}: #{exception.reason}")
    render json: { error: 'Gotchu refused that mapping', reason: exception.reason }, status: :unprocessable_entity
  end

  def render_not_found(_exception)
    Rails.logger.warn("Gotchu found no such store for account #{params[:account_id]}")
    render json: { error: 'No such store', reason: 'not_found' }, status: :not_found
  end

  def render_stores_changed(_exception)
    render json: { error: 'Your stores changed since this page was opened. Reload and try again.', reason: 'stores_changed' },
           status: :conflict
  end

  # Relays the gateway's own body shape (progress.md "Carry to Task 5/6"):
  # the screen needs the exact ids back to re-render its warning, not just a
  # generic refusal. These are the account's OWN mapped ids, which its GET
  # already showed it, so naming them again is not an oracle for anything
  # the admin could not already see.
  def render_unlisted_inbox_dropped(exception)
    Rails.logger.warn("Gotchu refused to drop an unacknowledged inbox for account #{params[:account_id]}")
    render json: { error: 'unlisted_inbox_dropped', reason: 'unlisted_inbox_dropped', inboxIds: exception.inbox_ids },
           status: :conflict
  end

  def render_too_many_saves(_exception)
    Rails.logger.warn("Gotchu throttled a store-routes save for account #{params[:account_id]}")
    render json: { error: 'Too many saves in a short time', reason: 'too_many_saves' }, status: :too_many_requests
  end

  # A PUT 500 is opaque at this end: it means the gateway's own reload was
  # refused after a committed write (storeRoutes.ts's store_routes.reload_
  # refused), OR it means the write itself never happened -- a Postgres
  # outage hits the same gateway catch-all and answers the same bare 500.
  # This proxy cannot tell those apart, so neither the log line nor the
  # response may claim the save landed; "could not confirm" is the only
  # honest thing to say either way (Task 5 fix round 1).
  def render_unconfirmed(exception)
    Rails.logger.error("Gotchu store routes could not confirm a save for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Could not confirm the save. Reload the page to see whether it landed.', reason: 'unconfirmed' },
           status: :internal_server_error
  end
end
