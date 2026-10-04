require 'rails_helper'

RSpec.describe 'Gotchu Procedures API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:procedures_endpoint) { "#{gateway_url}/api/procedures" }
  # Every body the gateway was actually sent, parsed. Captured in the stub's
  # own matcher, the same way the instruct spec does it, so an assertion
  # about what travelled is about the request that travelled.
  let(:sent) { [] }
  let(:valid_params) do
    { slug: 'return-window', title: 'Return window', body: 'Offer a 30 day return window.', phrases: ['I want to return this'] }
  end

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    # accountId:secret,accountId:secret -- nil (the default) means no
    # per-account entries at all, so every account falls back to `secret`
    # above, which is exactly today's one-account deployment.
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def procedures_url
    "/api/v1/accounts/#{account.id}/gotchu/procedures"
  end

  def procedure_url(id)
    "#{procedures_url}/#{id}"
  end

  def status_url(id)
    "#{procedure_url(id)}/status"
  end

  def replay_url
    "#{procedures_url}/replay"
  end

  def stub_list(status: 200, body: { procedures: [] }, query: { secret: gateway_secret })
    stub_request(:get, procedures_endpoint)
      .with(query: query, headers: { 'x-gesture-secret' => gesture_secret })
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def stub_write(url, status: 200, body: {})
    stub_request(:post, url)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  # Same shape as stub_write, for the one route on this surface that writes
  # with PUT rather than POST (bindings/:channel — it replaces one channel's
  # binding, which is what PUT means; every other write here creates a new
  # row, which is why they are POST).
  def stub_put(url, status: 200, body: {})
    stub_request(:put, url)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def forwarded_body
    sent.last
  end

  # Security review L2 (final, 6.3), the same check as the store routes.
  describe 'an agent-bot access token' do
    let(:agent_bot) { create(:agent_bot, account: account) }

    it 'is refused without reaching the gateway' do
      get "/api/v1/accounts/#{account.id}/gotchu/procedures",
          headers: { api_access_token: agent_bot.access_token.token }, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /gateway/)).not_to have_been_made
    end

    it 'is refused by the admin check itself when no account_user is set, rather than raising NoMethodError' do
      controller = Api::V1::Accounts::Gotchu::ProceduresController.new
      Current.account_user = nil
      expect { controller.send(:check_admin_authorization?) }.to raise_error(Pundit::NotAuthorizedError)
    ensure
      Current.reset
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/gotchu/procedures' do
    it 'returns unauthorized for an unauthenticated caller, and never reaches the gateway' do
      configure_gateway

      get procedures_url

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:get, procedures_endpoint)).not_to have_been_made
    end

    it 'lets an agent who is not an administrator read the list' do
      configure_gateway
      list = stub_list

      get procedures_url, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:ok)
      expect(list).to have_been_made
    end

    context 'when it is an administrator' do
      it 'sends both credentials, the secret in the query and the gesture secret in the header' do
        configure_gateway
        stub_list

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:get, procedures_endpoint)
            .with(query: { secret: gateway_secret }, headers: { 'x-gesture-secret' => gesture_secret })
        ).to have_been_made
      end

      it 'returns the gateway list merged with capabilities' do
        configure_gateway
        stub_list(body: { procedures: [{ id: 1, slug: 'return-window' }] })

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['procedures']).to eq([{ 'id' => 1, 'slug' => 'return-window' }])
        expect(response.parsed_body['capabilities']).to eq({ 'procedures' => true })
      end

      it 'passes a store filter through as a query param' do
        configure_gateway
        stub_list(query: { secret: gateway_secret, store: 'persoliebe' }, body: { procedures: [] })

        get "#{procedures_url}?store=persoliebe", headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:get, procedures_endpoint).with(query: { secret: gateway_secret, store: 'persoliebe' })
        ).to have_been_made
      end

      it 'reports the capability as unavailable when the gateway is not configured' do
        configure_gateway(url: nil)

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['capabilities']).to eq({ 'procedures' => false })
        expect(response.parsed_body['procedures']).to eq([])
      end

      it 'never reaches the gateway when it is not configured' do
        configure_gateway(url: nil)

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(a_request(:get, %r{.*/api/procedures.*})).not_to have_been_made
      end

      it 'reports an unknown store filter as a validation error, not a crash' do
        configure_gateway
        stub_list(query: { secret: gateway_secret, store: 'nope' }, status: 400, body: { error: 'unknown store: nope' })

        get "#{procedures_url}?store=nope", headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/gotchu/procedures' do
    it 'refuses an agent who is not an administrator' do
      configure_gateway

      post procedures_url, params: valid_params, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, procedures_endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'creates the procedure and relays the gateway response' do
        configure_gateway
        stub_write(procedures_endpoint, body: { id: 9, slug: 'return-window', status: 'testing', version: 1 })

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body).to eq({ 'id' => 9, 'slug' => 'return-window', 'status' => 'testing', 'version' => 1 })
      end

      it 'takes the actor from the session, never from the body' do
        configure_gateway
        stub_write(procedures_endpoint, body: { id: 9 })

        post procedures_url, params: valid_params.merge(actor: 'chatwoot:999'), headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['actor']).to eq("chatwoot:#{admin.id}")
      end

      it 'sends both credentials, the secret in the query and the gesture secret in the header' do
        configure_gateway
        stub_write(procedures_endpoint, body: { id: 9 })

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:post, procedures_endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'Content-Type' => 'application/json' }
          )
        ).to have_been_made
      end

      it 'forwards slug, title, body, phrases and storeKey, and never a status' do
        configure_gateway
        stub_write(procedures_endpoint, body: { id: 9 })

        post procedures_url, params: valid_params.merge(store_key: 'persoliebe', status: 'active'),
                             headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body).to include(
          'slug' => 'return-window',
          'title' => 'Return window',
          'body' => 'Offer a 30 day return window.',
          'phrases' => ['I want to return this'],
          'storeKey' => 'persoliebe'
        )
        expect(forwarded_body).not_to have_key('status')
      end

      it 'uses the short gesture timeout, unlike replay' do
        configure_gateway
        fake_response = instance_double(HTTParty::Response, code: 200, body: { id: 9 }.to_json)
        expect(HTTParty).to receive(:post)
          .with(procedures_endpoint, hash_including(timeout: Gotchu::ProcedureService::TIMEOUT_SECONDS))
          .and_return(fake_response)

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
      end

      it 'reports a duplicate slug as a conflict' do
        configure_gateway
        stub_write(procedures_endpoint, status: 409,
                                        body: { error: 'a procedure with slug "return-window" already exists for this store' })

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('duplicate_slug')
      end

      it 'reports a validation failure from the gateway as unprocessable' do
        configure_gateway
        stub_write(procedures_endpoint, status: 400, body: { error: 'slug, title, body and phrases are required' })

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
      end

      it 'says it is not configured when a credential is missing' do
        configure_gateway(gesture: nil)

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['reason']).to eq('unconfigured')
        expect(a_request(:post, procedures_endpoint)).not_to have_been_made
      end

      it 'could not confirm, rather than failed, when the gateway does not answer' do
        configure_gateway
        stub_request(:post, procedures_endpoint).with(query: { secret: gateway_secret }).to_timeout

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      it 'leaks neither the gateway address nor its status code nor its words' do
        configure_gateway
        stub_write(procedures_endpoint, status: 502, body: { error: 'could not embed the trigger phrases' })

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.body).not_to include(gateway_url)
        expect(response.body).not_to include('could not embed')
        expect(response.body).not_to include('502')
      end
    end
  end

  describe 'PATCH /api/v1/accounts/{account.id}/gotchu/procedures/{id}' do
    let(:revise_endpoint) { "#{gateway_url}/api/procedures/9/revisions" }
    let(:revise_params) { { title: 'Return window, updated', body: 'Offer a 45 day return window.', phrases: %w[return refund] } }

    it 'refuses an agent who is not an administrator' do
      configure_gateway

      patch procedure_url(9), params: revise_params, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, revise_endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'revises the procedure and relays the gateway response' do
        configure_gateway
        stub_write(revise_endpoint, body: { id: 9, version: 2 })

        patch procedure_url(9), params: revise_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body).to eq({ 'id' => 9, 'version' => 2 })
      end

      it 'takes the actor from the session, never from the body, and never forwards a slug' do
        configure_gateway
        stub_write(revise_endpoint, body: { id: 9 })

        patch procedure_url(9), params: revise_params.merge(actor: 'chatwoot:999', slug: 'a-different-slug'),
                                headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['actor']).to eq("chatwoot:#{admin.id}")
        expect(forwarded_body).not_to have_key('slug')
      end

      it 'sends both credentials, the secret in the query and the gesture secret in the header' do
        configure_gateway
        stub_write(revise_endpoint, body: { id: 9 })

        patch procedure_url(9), params: revise_params, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:post, revise_endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'Content-Type' => 'application/json' }
          )
        ).to have_been_made
      end

      it 'reports an unknown procedure id as not found' do
        configure_gateway
        stub_write(revise_endpoint, status: 404, body: { error: 'no such procedure' })

        patch procedure_url(9), params: revise_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body['reason']).to eq('not_found')
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/gotchu/procedures/{id}/status' do
    let(:status_endpoint) { "#{gateway_url}/api/procedures/9/status" }

    it 'refuses an agent who is not an administrator' do
      configure_gateway

      post status_url(9), params: { status: 'active' }, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, status_endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'changes the status and relays the gateway response' do
        configure_gateway
        stub_write(status_endpoint, body: { id: 9, status: 'active' })

        post status_url(9), params: { status: 'active' }, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body).to eq({ 'id' => 9, 'status' => 'active' })
      end

      it 'takes the actor from the session, never from the body' do
        configure_gateway
        stub_write(status_endpoint, body: { id: 9 })

        post status_url(9), params: { status: 'active', actor: 'chatwoot:999' }, headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['actor']).to eq("chatwoot:#{admin.id}")
      end

      it 'reports an unknown status value as a validation error' do
        configure_gateway
        stub_write(status_endpoint, status: 400, body: { error: 'status must be one of: testing|active|archived' })

        post status_url(9), params: { status: 'bogus' }, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
      end

      it 'reports an unknown procedure id as not found' do
        configure_gateway
        stub_write(status_endpoint, status: 404, body: { error: 'no such procedure' })

        post status_url(9), params: { status: 'active' }, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body['reason']).to eq('not_found')
      end
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/gotchu/procedures/{id}/bindings' do
    let(:bindings_endpoint) { "#{gateway_url}/api/procedures/9/bindings" }

    def bindings_url(id)
      "#{procedure_url(id)}/bindings"
    end

    it 'lets an agent who is not an administrator read the bindings' do
      configure_gateway
      read = stub_request(:get, bindings_endpoint)
             .with(query: { secret: gateway_secret }, headers: { 'x-gesture-secret' => gesture_secret })
             .to_return(status: 200, body: { bindings: [] }.to_json, headers: { 'Content-Type' => 'application/json' })

      get bindings_url(9), headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:ok)
      expect(read).to have_been_made
    end

    context 'when it is an administrator' do
      it 'relays the gateway bindings list' do
        configure_gateway
        stub_request(:get, bindings_endpoint)
          .with(query: { secret: gateway_secret }, headers: { 'x-gesture-secret' => gesture_secret })
          .to_return(
            status: 200,
            body: {
              bindings: [
                { procedureId: 9, channel: 'email', tier: 'auto', authorisedVersion: 3, setBy: 'chatwoot:1',
                  setAt: '2026-09-23T00:00:00Z' }
              ]
            }.to_json,
            headers: { 'Content-Type' => 'application/json' }
          )

        get bindings_url(9), headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['bindings']).to eq(
          [
            { 'procedureId' => 9, 'channel' => 'email', 'tier' => 'auto', 'authorisedVersion' => 3,
              'setBy' => 'chatwoot:1', 'setAt' => '2026-09-23T00:00:00Z' }
          ]
        )
      end

      it 'reports an unknown procedure id as not found' do
        configure_gateway
        stub_request(:get, bindings_endpoint)
          .with(query: { secret: gateway_secret })
          .to_return(status: 404, body: { error: 'no such procedure' }.to_json,
                     headers: { 'Content-Type' => 'application/json' })

        get bindings_url(9), headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body['reason']).to eq('not_found')
      end
    end
  end

  describe 'PUT /api/v1/accounts/{account.id}/gotchu/procedures/{id}/bindings/{channel}' do
    let(:binding_endpoint) { "#{gateway_url}/api/procedures/9/bindings/email" }

    def binding_url(id, channel)
      "#{procedure_url(id)}/bindings/#{channel}"
    end

    it 'refuses an agent who is not an administrator' do
      configure_gateway

      put binding_url(9, 'email'), params: { tier: 'auto', expected_version: 3 }, headers: agent.create_new_auth_token,
                                    as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:put, binding_endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'raises the channel to a tier and relays the gateway response, binding wrapper intact' do
        configure_gateway
        # The gateway wraps its response as `{ binding: {...} }`, never a
        # bare binding at the top level -- the controller is a pass-through
        # (`render json: service.set_binding(...)`), so it must relay that
        # wrapper exactly as received.
        stub_put(binding_endpoint, body: { binding: { procedureId: 9, channel: 'email', tier: 'draft',
                                                        authorisedVersion: nil, setBy: 'chatwoot:1',
                                                        setAt: '2026-09-23T00:00:00Z' } })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['binding']['tier']).to eq('draft')
        expect(response.parsed_body['binding']['procedureId']).to eq(9)
      end

      it 'relays a `binding: null` response verbatim when the write turned the channel off' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: nil })

        put binding_url(9, 'email'), params: { tier: nil, expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body).to eq('binding' => nil)
      end

      it 'takes the actor from the session, never from the body' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: { channel: 'email', tier: 'draft' } })

        put binding_url(9, 'email'),
            params: { tier: 'draft', expected_version: 3, actor: 'chatwoot:999' },
            headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['actor']).to eq("chatwoot:#{admin.id}")
      end

      it 'sends tier, actor and expectedVersion, and only those three keys' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: { channel: 'email', tier: 'draft' } })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body.keys).to contain_exactly('tier', 'actor', 'expectedVersion')
        expect(forwarded_body['expectedVersion']).to eq(3)
      end

      it 'never forwards params[:version] or params[:authorised_version] -- only params[:expected_version] becomes expectedVersion' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: { channel: 'email', tier: 'draft' } })

        put binding_url(9, 'email'),
            params: { tier: 'draft', expected_version: 3, version: 999, authorised_version: 999 },
            headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['expectedVersion']).to eq(3)
        expect(forwarded_body).not_to have_key('version')
        expect(forwarded_body).not_to have_key('authorisedVersion')
        expect(forwarded_body).not_to have_key('authorised_version')
      end

      it 'sends an explicit tier: null to turn a channel off' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: nil })

        put binding_url(9, 'email'), params: { tier: nil, expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body).to have_key('tier')
        expect(forwarded_body['tier']).to be_nil
      end

      it 'rejects a tier outside draft|auto|null with 422, and never calls the gateway' do
        configure_gateway

        put binding_url(9, 'email'), params: { tier: 'bogus', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
        expect(a_request(:put, binding_endpoint)).not_to have_been_made
      end

      it 'rejects a missing expected_version locally, with its own reason, and never calls the gateway' do
        configure_gateway

        put binding_url(9, 'email'), params: { tier: 'draft' }, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        # Its own reason, not 'invalid' -- 'invalid' is what the
        # slug-format/length-limits copy (ERRORS.INVALID) is written for,
        # and would be the wrong message on this screen.
        expect(response.parsed_body['reason']).to eq('version_required')
        expect(a_request(:put, binding_endpoint)).not_to have_been_made
      end

      it 'rejects a blank expected_version locally the same way as a missing one' do
        configure_gateway

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: '' },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('version_required')
        expect(a_request(:put, binding_endpoint)).not_to have_been_made
      end

      it 'sends both credentials, the secret in the query and the gesture secret in the header' do
        configure_gateway
        stub_put(binding_endpoint, body: { binding: { channel: 'email', tier: 'draft' } })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:put, binding_endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'Content-Type' => 'application/json' }
          )
        ).to have_been_made
      end

      it 'reports an unknown procedure id as not found' do
        configure_gateway
        stub_put(binding_endpoint, status: 404, body: { error: 'no such procedure' })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:not_found)
        expect(response.parsed_body['reason']).to eq('not_found')
      end

      it 'reports a stale version conflict and tells the admin to reload' do
        configure_gateway
        stub_put(binding_endpoint, status: 409, body: { error: 'the procedure changed since you opened it' })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('stale_version')
      end

      it 'reports auto on a non-active procedure as its own conflict reason' do
        configure_gateway
        stub_put(binding_endpoint, status: 409, body: { error: 'only an active procedure can be raised to auto' })

        put binding_url(9, 'email'), params: { tier: 'auto', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('not_active_for_auto')
      end

      it 'reports could not confirm, not a fabricated conflict reason, on a 409 body this build does not recognise' do
        configure_gateway
        stub_put(binding_endpoint, status: 409, body: { error: 'some future reason nobody wrote a case for' })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end

      it 'reports a bad request from the gateway as unprocessable' do
        configure_gateway
        stub_put(binding_endpoint, status: 400, body: { error: 'unknown channel' })

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
      end

      it 'could not confirm, rather than failed, when the gateway does not answer' do
        configure_gateway
        stub_request(:put, binding_endpoint).with(query: { secret: gateway_secret }).to_timeout

        put binding_url(9, 'email'), params: { tier: 'draft', expected_version: 3 },
                                      headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/gotchu/procedures/replay' do
    let(:replay_endpoint) { "#{gateway_url}/api/procedures/replay" }

    it 'refuses an agent who is not an administrator' do
      configure_gateway

      post replay_url, params: {}, headers: agent.create_new_auth_token, as: :json

      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:post, replay_endpoint)).not_to have_been_made
    end

    context 'when it is an administrator' do
      it 'sends both credentials, the secret in the query and the gesture secret in the header' do
        configure_gateway
        stub_write(replay_endpoint, body: { days: 30, considered: 0, cappedByWindow: false, timedOut: false, byResolution: {}, byProcedure: [] })

        post replay_url, params: {}, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:post, replay_endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'Content-Type' => 'application/json' }
          )
        ).to have_been_made
      end

      it 'takes the actor from the session, never from the body' do
        configure_gateway
        stub_write(replay_endpoint, body: { days: 30, considered: 0, cappedByWindow: false, timedOut: false, byResolution: {}, byProcedure: [] })

        post replay_url, params: { actor: 'chatwoot:999' }, headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body['actor']).to eq("chatwoot:#{admin.id}")
      end

      it 'never sends a sample parameter — sampling was removed from the HTTP surface' do
        configure_gateway
        stub_write(replay_endpoint, body: { days: 30, considered: 0, cappedByWindow: false, timedOut: false, byResolution: {}, byProcedure: [] })

        post replay_url, params: { sample: 5 }, headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body).not_to have_key('sample')
      end

      it 'forwards optional days, storeKey and procedureId filters' do
        configure_gateway
        stub_write(replay_endpoint, body: { days: 7, considered: 0, cappedByWindow: false, timedOut: false, byResolution: {}, byProcedure: [] })

        post replay_url, params: { days: 7, store_key: 'persoliebe', procedure_id: 4 },
                         headers: admin.create_new_auth_token, as: :json

        expect(forwarded_body).to include('days' => 7, 'storeKey' => 'persoliebe', 'procedureId' => 4)
      end

      it 'relays a timed-out, capped result so the screen can say the scan did not finish' do
        configure_gateway
        stub_write(replay_endpoint, body: { days: 30, considered: 200, cappedByWindow: true, timedOut: true, byResolution: {}, byProcedure: [] })

        post replay_url, params: {}, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['timedOut']).to be(true)
        expect(response.parsed_body['cappedByWindow']).to be(true)
        expect(response.parsed_body['considered']).to eq(200)
      end

      it 'uses a timeout comfortably above the gateway replay budget, unlike the other routes' do
        configure_gateway
        fake_response = instance_double(
          HTTParty::Response, code: 200,
                              body: { days: 30, considered: 0, cappedByWindow: false, timedOut: false, byResolution: {}, byProcedure: [] }.to_json
        )
        expect(HTTParty).to receive(:post)
          .with(replay_endpoint, hash_including(timeout: Gotchu::ProcedureService::REPLAY_TIMEOUT_SECONDS))
          .and_return(fake_response)

        post replay_url, params: {}, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
      end

      it 'could not confirm, rather than failed, when the gateway does not answer' do
        configure_gateway
        stub_request(:post, replay_endpoint).with(query: { secret: gateway_secret }).to_timeout

        post replay_url, params: {}, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
      end
    end
  end

  # Task 11: the gateway is becoming multi-tenant, so this proxy must send
  # the calling account's own secret rather than one shared by every
  # account, plus a header the gateway can cross-check the secret against.
  describe 'account-scoped gateway credentials' do
    context 'when it is an administrator' do
      it "sends the account's own secret from GOTCHU_GATEWAY_SECRETS, not the shared single variable" do
        own_secret = 'only-for-this-account'
        configure_gateway(secrets: "#{account.id}:#{own_secret}")
        stub_list(query: { secret: own_secret })

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(a_request(:get, procedures_endpoint).with(query: { secret: own_secret })).to have_been_made
        expect(a_request(:get, procedures_endpoint).with(query: { secret: gateway_secret })).not_to have_been_made
      end

      it 'sends X-Chatwoot-Account-Id naming the calling account' do
        configure_gateway
        stub_list

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:get, procedures_endpoint).with(
            query: { secret: gateway_secret }, headers: { 'X-Chatwoot-Account-Id' => account.id.to_s }
          )
        ).to have_been_made
      end

      it 'still sends the install-level gesture header unchanged, alongside the new account header' do
        configure_gateway
        stub_list

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(
          a_request(:get, procedures_endpoint).with(
            query: { secret: gateway_secret },
            headers: { 'x-gesture-secret' => gesture_secret, 'X-Chatwoot-Account-Id' => account.id.to_s }
          )
        ).to have_been_made
      end

      # Fix wave E: once GOTCHU_GATEWAY_SECRETS exists, an account it does
      # not list gets no secret at all -- never the legacy account's single
      # variable -- so the fork answers 503 without calling the gateway.
      it 'answers 503 and makes no request for an account a set map does not list, even with the single variable set' do
        configure_gateway(secrets: '999999:someone-elses-secret')

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(a_request(:any, /\A#{Regexp.escape(procedures_endpoint)}/)).not_to have_been_made
      end

      it 'answers 503 and makes no request when neither the map nor the single variable name this account' do
        configure_gateway(secret: nil, secrets: '999999:someone-elses-secret')

        post procedures_url, params: valid_params, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['reason']).to eq('unconfigured')
        expect(a_request(:post, procedures_endpoint)).not_to have_been_made
      end

      # Coordinator ruling, Task 11 follow-up: `available?` (which the index
      # action and `capabilities` both call) must answer from per-account
      # resolution, not the global variable alone.
      it 'reports the capability as available for an account named only in the per-account map, with no single fallback secret' do
        own_secret = 'only-for-this-account'
        configure_gateway(secret: nil, secrets: "#{account.id}:#{own_secret}")
        stub_list(query: { secret: own_secret })

        get procedures_url, headers: admin.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body['capabilities']).to eq({ 'procedures' => true })
      end
    end
  end

  # Decision 1 of the agent-screens plan: every signed-in agent reads the
  # Agent pages; writes to procedures stay administrator-only.
  describe 'who may read and who may write' do
    before { configure_gateway }

    it 'lets an agent read the list' do
      stub_list
      get procedures_url, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:ok)
    end

    it 'refuses an agent a write without calling the gateway' do
      post procedures_url, params: valid_params, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(a_request(:any, /gateway.test/)).not_to have_been_made
    end
  end
end
