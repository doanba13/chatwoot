require 'rails_helper'

RSpec.describe 'Gotchu Store Routes API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:endpoint) { "#{gateway_url}/api/stores/routes" }
  let(:routes_url) { "/api/v1/accounts/#{account.id}/gotchu/store_routes" }
  # Every body the gateway was sent, parsed, captured in the stub's own matcher.
  let(:sent) { [] }
  let(:routes_payload) do
    {
      stores: [{ key: 'persoliebe', name: 'Persoliebe', shopEmails: ['kontakt@persoliebe.com'], inboxes: [{ id: 2, channel: 'messenger' }] }],
      inboxes: [{ id: 1, name: 'Support Mail', channel: 'email' }, { id: 2, name: 'PL Messenger', channel: 'messenger' }]
    }
  end
  let(:update_params) do
    { stores: [{ key: 'persoliebe', shop_emails: ['kontakt@persoliebe.com'], inbox_ids: [2] }] }
  end

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def stub_read(status: 200, body: routes_payload, secret: gateway_secret)
    stub_request(:get, endpoint)
      .with(query: { secret: secret })
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def stub_replace(status: 200, body: routes_payload)
    stub_request(:put, endpoint)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  describe 'GET /api/v1/accounts/{account.id}/gotchu/store_routes' do
    it 'returns unauthorized for an unauthenticated caller, and never reaches the gateway' do
      configure_gateway
      get routes_url
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:get, endpoint)).not_to have_been_made
    end

    it 'refuses an agent who is not an administrator' do
      configure_gateway
      get routes_url, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:get, endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'sends the secret in the query, the gesture secret and the account id in headers' do
        configure_gateway
        stub_read
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(
          a_request(:get, endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'X-Chatwoot-Account-Id' => account.id.to_s }
          )
        ).to have_been_made
      end

      it 'returns the gateway mapping merged with capabilities' do
        configure_gateway
        stub_read
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq(routes_payload.deep_stringify_keys.merge('capabilities' => { 'store_routes' => true }))
      end

      it 'answers an honest empty state when the gateway is not configured, without calling it' do
        configure_gateway(url: nil)
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(response.parsed_body).to eq('stores' => [], 'inboxes' => [], 'capabilities' => { 'store_routes' => false })
        expect(a_request(:get, endpoint)).not_to have_been_made
      end

      it "uses this account's own secret from GOTCHU_GATEWAY_SECRETS" do
        configure_gateway(secret: nil, secrets: "#{account.id}:per-account-secret")
        stub_read(secret: 'per-account-secret')
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
      end

      it 'reads a gateway 404 on the list as unavailable, since it can only mean the surface is dark' do
        configure_gateway
        stub_read(status: 404, body: { error: 'not found' })
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      it 'answers 502 unavailable when the gateway fails' do
        configure_gateway
        stub_read(status: 502, body: { error: "could not read this account's inboxes", reason: 'unavailable' })
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      # Fix round 1: a PUT 500 is genuinely ambiguous (reload refused after a
      # real commit, or a write that never happened at all -- see the
      # service's UnconfirmedError comment), which is why it gets its own
      # reason there. A GET never writes anything, so there is nothing for it
      # to have "possibly landed"; it stays plain unavailable.
      it 'reads a gateway 500 on the list as unavailable, never unconfirmed, since a read has nothing to have half-landed' do
        configure_gateway
        stub_read(status: 500, body: { error: 'internal error' })
        get routes_url, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end
    end
  end

  # Security review L2 (final, 6.3): an agent-bot token carries no
  # account_user. It must be refused, never reach the gateway, and never 500.
  describe 'an agent-bot access token' do
    let(:agent_bot) { create(:agent_bot, account: account) }

    it 'is refused on the read and on the save, without reaching the gateway' do
      configure_gateway
      get routes_url, headers: { api_access_token: agent_bot.access_token.token }, as: :json
      expect(response).to have_http_status(:unauthorized)
      put routes_url, params: update_params, headers: { api_access_token: agent_bot.access_token.token }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, endpoint)).not_to have_been_made
    end

    it 'is refused by the admin check itself when no account_user is set, rather than raising NoMethodError' do
      controller = Api::V1::Accounts::Gotchu::StoreRoutesController.new
      Current.account_user = nil
      expect { controller.send(:check_admin_authorization?) }.to raise_error(Pundit::NotAuthorizedError)
    ensure
      Current.reset
    end
  end

  describe 'PUT /api/v1/accounts/{account.id}/gotchu/store_routes' do
    it 'refuses an agent who is not an administrator' do
      configure_gateway
      put routes_url, params: update_params, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:put, endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'forwards the mapping in the gateway shape, with the actor from the session and never a channel' do
        configure_gateway
        stub_replace
        body = { stores: [update_params[:stores][0].merge(channel: 'email')], actor: 'chatwoot:999' }
        put routes_url, params: body, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(sent.last).to eq(
          'stores' => [{ 'key' => 'persoliebe', 'shopEmails' => ['kontakt@persoliebe.com'], 'inboxIds' => [2] }],
          'actor' => "chatwoot:#{admin.id}"
        )
      end

      it 'sends both credentials, the account id and a JSON content type' do
        configure_gateway
        stub_replace
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(
          a_request(:put, endpoint).with(
            query: { secret: gateway_secret },
            headers: {
              'x-gesture-secret' => gesture_secret,
              'X-Chatwoot-Account-Id' => account.id.to_s,
              'Content-Type' => 'application/json'
            }
          )
        ).to have_been_made
      end

      it 'refuses a body without a stores list locally, never reaching the gateway' do
        configure_gateway
        put routes_url, params: { stores: 'persoliebe' }, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
        expect(a_request(:put, endpoint)).not_to have_been_made
      end

      [%w[duplicate duplicate], %w[one_per_channel one_per_channel], %w[invalid invalid], %w[something_new invalid]].each do |given, expected|
        it "maps a gateway 400 with reason #{given} to #{expected}" do
          configure_gateway
          stub_replace(status: 400, body: { error: 'gateway words that must not travel', reason: given })
          put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
          expect(response).to have_http_status(:unprocessable_entity)
          expect(response.parsed_body['reason']).to eq(expected)
          expect(response.body).not_to include('gateway words that must not travel')
        end
      end

      it 'maps a 404 to not_found' do
        configure_gateway
        stub_replace(status: 404, body: { error: 'no such store' })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body['reason']).to eq('not_found')
      end

      # Security review M1 (final, 6.3): the gateway throttles saves per
      # account and answers 429; the screen needs its own reason for it, not
      # the generic "did not confirm", because waiting is the whole fix.
      it 'maps a gateway 429 to too_many_saves' do
        configure_gateway
        stub_replace(status: 429, body: { error: 'too_many_saves' })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:too_many_requests)
        expect(response.parsed_body).to eq('error' => 'Too many saves in a short time', 'reason' => 'too_many_saves')
      end

      it 'maps a 409 to stores_changed' do
        configure_gateway
        stub_replace(status: 409, body: { error: 'the stores changed', reason: 'stores_changed' })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('stores_changed')
      end

      it 'answers 502 unavailable when the gateway does not answer in time' do
        configure_gateway
        stub_request(:put, endpoint).with(query: { secret: gateway_secret }).to_timeout
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      # Carried from Task 3/4 (progress.md "Carry to Task 5/6"): the gateway
      # grew a third PUT field and a second, distinct 409 shape after this
      # controller's own interface list was written, plus a 500 that means
      # something different from every other failure on this route. All
      # three are asserted here rather than left to Task 6 to discover.
      it 'forwards acknowledgeRemoved to the gateway unchanged when the admin acknowledged a drop' do
        configure_gateway
        stub_replace
        body = update_params.merge(acknowledge_removed: [5, 7])
        put routes_url, params: body, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(sent.last['acknowledgeRemoved']).to eq([5, 7])
      end

      it 'sends no acknowledgeRemoved key at all when nothing was acknowledged' do
        configure_gateway
        stub_replace
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(sent.last).not_to have_key('acknowledgeRemoved')
      end

      # Fix round 1: acknowledge_removed is read through
      # `params.permit(acknowledge_removed: [])`, which only ever yields a
      # scalar array or nil -- never `Array(raw)`'s old behaviour of wrapping
      # a stray Hash into a one-element array and forwarding it.
      it 'does not forward acknowledge_removed when it is a hash rather than a scalar array' do
        configure_gateway
        stub_replace
        body = update_params.merge(acknowledge_removed: { sneaky: 'thing' })
        put routes_url, params: body, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:ok)
        expect(sent.last).not_to have_key('acknowledgeRemoved')
      end

      it 'relays a 409 unlisted_inbox_dropped as its own error, reason and inbox id list, distinct from stores_changed' do
        configure_gateway
        stub_replace(status: 409, body: { error: 'unlisted_inbox_dropped', inboxIds: [5, 7] })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body).to eq(
          'error' => 'unlisted_inbox_dropped', 'reason' => 'unlisted_inbox_dropped', 'inboxIds' => [5, 7]
        )
      end

      it 'reads a 409 body it does not recognise as unavailable rather than guessing which conflict it was' do
        configure_gateway
        stub_replace(status: 409, body: { error: 'a future conflict nobody wrote a case for' })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      # Fix round 1: a PUT 500 covers BOTH the reload-refused path (the write
      # committed) and the gateway's own catch-all (e.g. a Postgres outage,
      # where the write never happened at all) -- this proxy cannot tell
      # them apart, so the message must not claim the save landed.
      it 'relays a gateway 500 as unconfirmed, without claiming a save that may not have happened' do
        configure_gateway
        stub_replace(status: 500, body: { error: 'internal error' })
        put routes_url, params: update_params, headers: admin.create_new_auth_token, as: :json
        expect(response).to have_http_status(:internal_server_error)
        expect(response.parsed_body).to eq(
          'error' => 'Could not confirm the save. Reload the page to see whether it landed.', 'reason' => 'unconfirmed'
        )
        expect(response.body).not_to include('internal error')
      end
    end
  end
end
