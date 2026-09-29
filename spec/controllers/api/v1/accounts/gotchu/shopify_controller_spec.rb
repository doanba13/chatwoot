require 'rails_helper'

RSpec.describe 'Gotchu Shopify API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:sent) { [] }
  let(:authorize_url) { 'https://acme.myshopify.com/admin/oauth/authorize?client_id=cid&scope=read_orders&redirect_uri=x&state=s' }
  let(:callback_query) { 'code=c0de&hmac=abc&shop=acme.myshopify.com&state=s&timestamp=1' }

  def configure_gateway
    allow(ENV).to receive(:fetch).and_call_original
    { 'GOTCHU_GATEWAY_URL' => gateway_url, 'GOTCHU_GATEWAY_SECRET' => gateway_secret, 'GOTCHU_GATEWAY_SECRETS' => nil,
      'GOTCHU_GESTURE_SECRET' => gesture_secret }.each { |name, value| allow(ENV).to receive(:fetch).with(name, nil).and_return(value) }
  end

  def base = "/api/v1/accounts/#{account.id}/gotchu/shopify"

  def stub_gateway(verb, path, status: 200, body: {})
    headers = { 'x-gesture-secret' => gesture_secret, 'X-Chatwoot-Account-Id' => account.id.to_s }
    stub_request(verb, "#{gateway_url}#{path}")
      .with(query: { secret: gateway_secret }, headers: headers) do |request|
        sent << JSON.parse(request.body) if request.body.present?
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  describe 'POST install' do
    it 'refuses an agent who is not an administrator, and never reaches the gateway' do
      configure_gateway
      post "#{base}/install", params: { shop: 'acme' }, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, "#{gateway_url}/api/shopify/install").with(query: hash_including({}))).not_to have_been_made
    end

    it 'forwards the shop with the session actor, never a body actor, and relays the authorize URL' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', body: { authorizeUrl: authorize_url })
      post "#{base}/install", params: { shop: 'acme', actor: 'chatwoot:999' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:success)
      expect(response.parsed_body).to eq({ 'authorizeUrl' => authorize_url })
      expect(sent.last).to eq({ 'shop' => 'acme', 'actor' => "chatwoot:#{admin.id}" })
    end

    it 'refuses to relay an authorize URL that does not point at a myshopify.com host' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', body: { authorizeUrl: 'https://evil.test/admin/oauth/authorize' })
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(response.body).not_to include('evil.test')
    end

    it 'refuses to relay an http authorize URL, or one with credentials in front of the host' do
      configure_gateway
      ['http://acme.myshopify.com/admin/oauth/authorize', 'https://acme.myshopify.com@evil.test/admin/oauth/authorize'].each do |url|
        stub_gateway(:post, '/api/shopify/install', body: { authorizeUrl: url })
        post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
      end
    end

    it 'reports an invalid shop as unprocessable' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', status: 400, body: { error: 'invalid_shop' })
      post "#{base}/install", params: { shop: 'evil.test' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['reason']).to eq('invalid_shop')
    end

    it 'reads any other 400 as unavailable, since the caller cannot have caused it' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', status: 400, body: { error: 'actor is required' })
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(response.parsed_body['reason']).to eq('unavailable')
    end

    it 'relays the gateway save throttle as too_many_saves' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', status: 429, body: { error: 'too_many_saves' })
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:too_many_requests)
      expect(response.parsed_body['reason']).to eq('too_many_saves')
    end

    it 'says it is not configured when the gateway secret is missing' do
      configure_gateway
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:service_unavailable)
    end

    it 'could not confirm, rather than failed, when the gateway does not answer' do
      configure_gateway
      stub_request(:post, "#{gateway_url}/api/shopify/install").with(query: { secret: gateway_secret }).to_timeout
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(response.body).not_to include('gateway.test')
    end

    it 'reads a gateway 404 (the Shopify app is dark) as unavailable' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/install', status: 404, body: { error: 'not found' })
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(response.parsed_body['reason']).to eq('unavailable')
    end
  end

  describe 'POST complete' do
    it 'refuses an agent who is not an administrator, and never reaches the gateway' do
      configure_gateway
      post "#{base}/complete", params: { query: callback_query }, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, "#{gateway_url}/api/shopify/complete").with(query: hash_including({}))).not_to have_been_made
    end

    it 'forwards the query string with the session actor and account, even when the body names others' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', body: { storeKey: 'acme', prefixNeedsReview: true })
      post "#{base}/complete", params: { query: callback_query, actor: 'chatwoot:999', account_id: 999 },
                               headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ 'storeKey' => 'acme', 'prefixNeedsReview' => true })
      expect(sent.last).to eq({ 'query' => callback_query, 'actor' => "chatwoot:#{admin.id}" })
    end

    it 'sends only the stores account id header, from the URL account' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', body: { storeKey: 'acme', prefixNeedsReview: false })
      post "#{base}/complete", params: { query: callback_query, account_id: 999 }, headers: admin.create_new_auth_token, as: :json
      expect(a_request(:post, "#{gateway_url}/api/shopify/complete")
        .with(query: { secret: gateway_secret }, headers: { 'X-Chatwoot-Account-Id' => account.id.to_s })).to have_been_made
    end

    it 'refuses a query that is not a string, without reaching the gateway' do
      configure_gateway
      post "#{base}/complete", params: { query: { code: 'x' } }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['reason']).to eq('invalid_query')
      expect(a_request(:post, "#{gateway_url}/api/shopify/complete").with(query: hash_including({}))).not_to have_been_made
    end

    it 'relays install_failed with its reference, and nothing of the cause' do
      configure_gateway
      reference = '3f2b8c1e-5d0a-4c1e-9a55-0d2f3a4b5c6d'
      stub_gateway(:post, '/api/shopify/complete', status: 400, body: { error: 'install_failed', reference: reference, reason: 'bad_hmac' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body).to eq({ 'error' => 'The store could not be connected', 'reason' => 'install_failed', 'reference' => reference })
    end

    it 'drops a reference that is not shaped like an id, rather than relaying gateway free text' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', status: 400, body: { error: 'install_failed', reference: '<script>x</script>' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body['reason']).to eq('install_failed')
      expect(response.parsed_body['reference']).to be_nil
      expect(response.body).not_to include('script')
    end

    it 'maps invalid_query, too_many_saves and the other answers to their own reasons' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', status: 400, body: { error: 'invalid_query' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect([response.status, response.parsed_body['reason']]).to eq([422, 'invalid_query'])

      stub_gateway(:post, '/api/shopify/complete', status: 429, body: { error: 'too_many_saves' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect([response.status, response.parsed_body['reason']]).to eq([429, 'too_many_saves'])

      stub_gateway(:post, '/api/shopify/complete', status: 400, body: { error: 'actor is required' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect([response.status, response.parsed_body['reason']]).to eq([502, 'unavailable'])
    end

    it 'reads a gateway 404 (the Shopify app is dark) as unavailable, not as a failed install' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', status: 404, body: { error: 'not found' })
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(response.parsed_body['reason']).to eq('unavailable')
    end

    it 'says it is not configured when the gateway secret is missing' do
      configure_gateway
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:service_unavailable)
    end
  end

  describe 'GET stores' do
    it 'relays the store list, marking the Shopify app as available' do
      configure_gateway
      stores = [{ key: 'acme', name: 'Acme', shopDomain: 'acme.myshopify.com', orderPrefix: 'AC', status: 'active', auth: 'oauth' }]
      stub_gateway(:get, '/api/shopify/stores', body: { stores: stores })
      get "#{base}/stores", headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body['stores'].first['key']).to eq('acme')
      expect(response.parsed_body['capabilities']).to eq({ 'shopify_app' => true })
    end

    it 'reports the Shopify app as unavailable, not failed, when the gateway 404s the list' do
      configure_gateway
      stub_gateway(:get, '/api/shopify/stores', status: 404, body: { error: 'not found' })
      get "#{base}/stores", headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq({ 'stores' => [], 'capabilities' => { 'shopify_app' => false } })
    end

    it 'answers the same empty state without calling the gateway when Gotchu is not configured' do
      configure_gateway
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(nil)
      get "#{base}/stores", headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body).to eq({ 'stores' => [], 'capabilities' => { 'shopify_app' => false } })
      expect(a_request(:get, "#{gateway_url}/api/shopify/stores").with(query: hash_including({}))).not_to have_been_made
    end

    it 'still answers 502 unavailable when the gateway fails' do
      configure_gateway
      stub_gateway(:get, '/api/shopify/stores', status: 500, body: { error: 'internal error' })
      get "#{base}/stores", headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
    end

    it 'refuses an agent who is not an administrator' do
      configure_gateway
      get "#{base}/stores", headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe 'PUT stores/:store_key/prefix' do
    it 'refuses an agent who is not an administrator' do
      configure_gateway
      put "#{base}/stores/acme/prefix", params: { order_prefix: 'ACX' }, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it 'forwards the prefix with the session actor' do
      configure_gateway
      stub_gateway(:put, '/api/shopify/stores/acme/prefix', body: { key: 'acme', orderPrefix: 'ACX' })
      put "#{base}/stores/acme/prefix", params: { order_prefix: 'acx', actor: 'chatwoot:999' }, headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body).to eq({ 'key' => 'acme', 'orderPrefix' => 'ACX' })
      expect(sent.last).to eq({ 'orderPrefix' => 'acx', 'actor' => "chatwoot:#{admin.id}" })
    end

    it 'reports a taken prefix as a conflict and a foreign store as not found' do
      configure_gateway
      stub_gateway(:put, '/api/shopify/stores/acme/prefix', status: 409, body: { error: 'prefix_unavailable' })
      put "#{base}/stores/acme/prefix", params: { order_prefix: 'BE' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:conflict)
      stub_gateway(:put, '/api/shopify/stores/other/prefix', status: 404, body: { error: 'not found' })
      put "#{base}/stores/other/prefix", params: { order_prefix: 'BE' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it 'reports an invalid prefix as unprocessable' do
      configure_gateway
      stub_gateway(:put, '/api/shopify/stores/acme/prefix', status: 400, body: { error: 'invalid_prefix' })
      put "#{base}/stores/acme/prefix", params: { order_prefix: '123' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body['reason']).to eq('invalid_prefix')
    end

    it 'does not route a store key outside the gateway alphabet' do
      configure_gateway
      put "#{base}/stores/..%2Fadmin/prefix", params: { order_prefix: 'BE' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:not_found)
    end

    it 'relays the gateway save throttle as too_many_saves' do
      configure_gateway
      stub_gateway(:put, '/api/shopify/stores/acme/prefix', status: 429, body: { error: 'too_many_saves' })
      put "#{base}/stores/acme/prefix", params: { order_prefix: 'BE' }, headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body['reason']).to eq('too_many_saves')
    end
  end

  # Hardening copied from the store-routes proxy (6.3 A13): the gateway secret
  # rides in the query string, so it must reach neither a log line nor a
  # redirect target.
  describe 'transport failures' do
    it 'raises the error class only, so the secret in a socket error message never reaches the log' do
      configure_gateway
      logged = []
      %i[debug info warn error].each { |level| allow(Rails.logger).to receive(level) { |msg = nil, &blk| logged << (msg || blk&.call).to_s } }
      stub_request(:post, "#{gateway_url}/api/shopify/install").with(query: { secret: gateway_secret })
                                                               .to_raise(SocketError.new("failed to open #{gateway_url}?secret=#{gateway_secret}"))
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(logged.join("\n")).to include('SocketError')
      expect(logged.join("\n")).not_to include(gateway_secret)
      expect(response.body).not_to include(gateway_secret)
    end

    it 'does not follow a redirect, which would replay the secret at another host' do
      configure_gateway
      stub_request(:post, "#{gateway_url}/api/shopify/install").with(query: { secret: gateway_secret })
                                                               .to_return(status: 302, headers: { 'Location' => 'http://elsewhere.test/collect' })
      elsewhere = stub_request(:any, /elsewhere\.test/)
      post "#{base}/install", params: { shop: 'acme' }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:bad_gateway)
      expect(elsewhere).not_to have_been_requested
    end
  end

  # Shopify's one-time code, state and HMAC must not reach the logs: not in the
  # `complete` POST's params (Rails and lograge both read the filtered copy) and
  # not in the landing GET's path.
  describe 'logging of the OAuth return' do
    it 'filters the callback query out of the params the complete POST logs' do
      configure_gateway
      stub_gateway(:post, '/api/shopify/complete', body: { storeKey: 'acme', prefixNeedsReview: false })
      logged = []
      subscriber = ActiveSupport::Notifications.subscribe('process_action.action_controller') { |*, payload| logged << payload[:params] }
      post "#{base}/complete", params: { query: callback_query }, headers: admin.create_new_auth_token, as: :json
      ActiveSupport::Notifications.unsubscribe(subscriber)
      expect(logged.to_json).not_to include('c0de')
      expect(logged.to_json).not_to include('hmac=abc')
      expect(logged.first['query']).to eq('[FILTERED]')
    end

    it 'filters code, state, hmac and host out of the landing path, and leaves country_code alone' do
      path = '/app/accounts/1/settings/gotchu-stores?shopify_return=1&code=c0de&hmac=abc&state=s&host=aG9zdA&country_code=DE'
      # The env key Rails' request stack sets from config.filter_parameters.
      env = Rack::MockRequest.env_for(path).merge('action_dispatch.parameter_filter' => Rails.application.config.filter_parameters)
      filtered = ActionDispatch::Request.new(env).filtered_path
      expect(filtered).not_to match(/c0de|hmac=abc|state=s|aG9zdA/)
      expect(filtered).to include('country_code=DE')
    end
  end

  describe 'an agent-bot access token' do
    let(:agent_bot) { create(:agent_bot, account: account) }

    it 'is refused on every action, without reaching the gateway' do
      configure_gateway
      headers = { api_access_token: agent_bot.access_token.token }
      get "#{base}/stores", headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
      post "#{base}/install", params: { shop: 'acme' }, headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
      post "#{base}/complete", params: { query: callback_query }, headers: headers, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /gateway\.test/).with(query: hash_including({}))).not_to have_been_made
    end
  end
end
