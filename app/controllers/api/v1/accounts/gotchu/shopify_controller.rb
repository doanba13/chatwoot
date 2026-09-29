class Api::V1::Accounts::Gotchu::ShopifyController < Api::V1::Accounts::BaseController
  # Connecting a store and editing its prefix: administrators only, via the
  # MIT-core check (see ProceduresController). The gateway validates the shop,
  # the callback and the store key; this proxy's job is the session -- who is
  # asking, and for which account. Neither the actor nor the account is ever
  # read from the body.
  before_action :check_admin_authorization?

  rescue_from Gotchu::ShopifyService::ConfigurationError, with: :render_unconfigured
  rescue_from Gotchu::ShopifyService::UnavailableError, with: :render_unavailable
  rescue_from Gotchu::ShopifyService::ValidationError, with: :render_invalid
  rescue_from Gotchu::ShopifyService::InstallFailedError, with: :render_install_failed
  rescue_from Gotchu::ShopifyService::NotFoundError, with: :render_not_found
  rescue_from Gotchu::ShopifyService::PrefixTakenError, with: :render_prefix_taken
  rescue_from Gotchu::ShopifyService::TooManySavesError, with: :render_too_many_saves

  def install
    render json: service.install(shop: params[:shop].to_s)
  end

  # The stores page forwards Shopify's callback query as one string. Anything
  # else is refused here, before the gateway is asked.
  def complete
    query = params[:query]
    return render_invalid(Gotchu::ShopifyService::ValidationError.new('invalid_query')) unless query.is_a?(String)

    render json: service.complete(query: query)
  end

  # A dark app (not configured here, or the gateway answers 404) is a
  # capability the page renders nothing for, not an error to toast.
  def stores
    return render json: dark_answer unless Gotchu::ShopifyService.available?(account_id: Current.account.id)

    render json: service.stores.merge('capabilities' => { 'shopify_app' => true })
  rescue Gotchu::ShopifyService::NotFoundError
    render json: dark_answer
  end

  def update_prefix
    render json: service.update_prefix(store_key: params[:store_key], order_prefix: params[:order_prefix].to_s)
  end

  private

  # Api::BaseController's own check calls `Current.account_user.administrator?`
  # and raises NoMethodError -- a 500 -- when no account_user is set, which is
  # what an agent-bot token carries. The safe navigation keeps this check
  # correct on its own (6.3 security review L2; StoreRoutesController).
  def check_admin_authorization?
    raise Pundit::NotAuthorizedError unless Current.account_user&.administrator?
  end

  def service
    @service ||= Gotchu::ShopifyService.new(actor_id: Current.user.id, account_id: Current.account.id)
  end

  def dark_answer
    { 'stores' => [], 'capabilities' => { 'shopify_app' => false } }
  end

  # params[:account_id], not Current.account: see ProceduresController on why
  # Current is already reset by the time a rescue_from handler runs.
  def render_unconfigured(exception)
    Rails.logger.error("Gotchu Shopify is not configured: #{exception.message}")
    render json: { error: 'Gotchu is not configured', reason: 'unconfigured' }, status: :service_unavailable
  end

  def render_unavailable(exception)
    Rails.logger.warn("Gotchu did not confirm a Shopify request for account #{params[:account_id]}: #{exception.message}")
    render json: { error: 'Gotchu did not confirm the request', reason: 'unavailable' }, status: :bad_gateway
  end

  def render_invalid(exception)
    Rails.logger.warn("Gotchu rejected a Shopify request for account #{params[:account_id]}: #{exception.reason}")
    render json: { error: 'That value was not accepted', reason: exception.reason }, status: :unprocessable_entity
  end

  # The reference is the gateway's correlation id for the refusal it logged
  # (with the cause); it is the only thing the admin can quote.
  def render_install_failed(exception)
    Rails.logger.warn("Gotchu could not complete a Shopify install for account #{params[:account_id]}, reference #{exception.reference}")
    render json: { error: 'The store could not be connected', reason: 'install_failed', reference: exception.reference }.compact,
           status: :unprocessable_entity
  end

  def render_not_found(_exception)
    Rails.logger.warn("Gotchu found no such Shopify store for account #{params[:account_id]}")
    render json: { error: 'No such store', reason: 'not_found' }, status: :not_found
  end

  def render_prefix_taken(_exception)
    render json: { error: 'That order prefix is already in use', reason: 'prefix_unavailable' }, status: :conflict
  end

  def render_too_many_saves(_exception)
    Rails.logger.warn("Gotchu throttled a Shopify request for account #{params[:account_id]}")
    render json: { error: 'Too many requests in a short time', reason: 'too_many_saves' }, status: :too_many_requests
  end
end
