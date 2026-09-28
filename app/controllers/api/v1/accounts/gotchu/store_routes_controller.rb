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

  def stores_param
    raw = params[:stores]
    return nil unless raw.is_a?(Array) && raw.all?(ActionController::Parameters)

    raw.map do |entry|
      store = entry.permit(:key, shop_emails: [], inbox_ids: [])
      { key: store[:key], shopEmails: Array(store[:shop_emails]), inboxIds: Array(store[:inbox_ids]) }
    end
  end

  # Mapped-but-invisible inbox ids the admin was shown and chose to drop
  # anyway. `nil` when the field is absent at all, so StoreRoutesService can
  # tell "nothing to acknowledge" apart from "acknowledged nothing" and the
  # gateway body carries no `acknowledgeRemoved` key for a save that never
  # mentioned one. Elementwise validation (positive integers) is left to the
  # gateway's own schema, the same posture `stores_param` already takes for
  # `inbox_ids`.
  def acknowledge_removed_param
    raw = params[:acknowledge_removed]
    raw.nil? ? nil : Array(raw)
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
    render json: { error: 'unlisted_inbox_dropped', inboxIds: exception.inbox_ids }, status: :conflict
  end

  # The write committed at the gateway; only the registry reload afterwards
  # was refused. Answering this the same way as render_unavailable would
  # tell the admin nothing happened when it might have, so it gets its own
  # reason and its own message (progress.md "Carry to Task 5/6": "saved,
  # could not confirm -- reload").
  def render_unconfirmed(exception)
    Rails.logger.error(
      "Gotchu store routes may have saved but the reload was not confirmed for account #{params[:account_id]}: #{exception.message}"
    )
    render json: { error: 'Saved, but could not confirm. Reload the page to check.', reason: 'unconfirmed' },
           status: :internal_server_error
  end
end
