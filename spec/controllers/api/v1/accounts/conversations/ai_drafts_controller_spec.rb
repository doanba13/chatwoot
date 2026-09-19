require 'rails_helper'

RSpec.describe 'Conversation AI Drafts API', type: :request do
  let(:account) { create(:account) }
  let(:conversation) { create(:conversation, account: account) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:draft_endpoint) { "#{gateway_url}/api/draft" }
  let(:payload) do
    {
      'cycle' => { 'id' => 12, 'state' => 'awaiting_review', 'storeKey' => 'persoliebe', 'expiresAt' => '2026-09-20T04:00:00.000Z' },
      'draft' => { 'version' => 2, 'body' => 'Ihre Sendung ist unterwegs.' }
    }
  end

  # `gesture` defaults to unset, which is the state every host is in: the read
  # needs neither that credential nor the write route behind it.
  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def draft_url(conversation_id = conversation.display_id)
    api_v1_account_conversation_ai_draft_url(account_id: account.id, conversation_id: conversation_id)
  end

  def stub_gateway(status: 200, body: payload)
    stub_request(:post, draft_endpoint)
      .with(query: { secret: gateway_secret })
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  describe 'GET /api/v1/accounts/{account.id}/conversations/{conversation.display_id}/ai_draft' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        get draft_url

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, draft_endpoint)).not_to have_been_made
      end
    end

    context 'when the user belongs to another account' do
      let(:other_account) { create(:account) }
      let(:other_agent) { create(:user, account: other_account, role: :administrator) }

      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        get draft_url, headers: other_agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, draft_endpoint)).not_to have_been_made
      end
    end

    context 'when the agent has no access to the conversation inbox' do
      let(:outsider) { create(:user, account: account, role: :agent) }

      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        get draft_url, headers: outsider.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, draft_endpoint)).not_to have_been_made
      end
    end

    context 'when it is an authenticated agent with access to the inbox' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'returns the gateway payload' do
        configure_gateway
        stub_gateway

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(response.parsed_body).to eq(payload.merge('capabilities' => { 'instruct' => false }))
      end

      it 'offers no instruction field while the gesture credential is unset' do
        # The dashboard drives the field off this and nothing else, so an
        # unconfigured deployment renders no field at all rather than one that
        # fails on press.
        configure_gateway
        stub_gateway

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response.parsed_body['capabilities']).to eq({ 'instruct' => false })
      end

      it 'offers the instruction field once the gesture credential is set' do
        # Server config, answered per read: turning it on is an env var and a
        # container restart, never a dashboard rebuild.
        configure_gateway(gesture: 'a-gesture-secret')
        stub_gateway

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response.parsed_body['capabilities']).to eq({ 'instruct' => true })
      end

      it 'reports no other gesture, whatever is configured' do
        # Send, discard, the adjustments and stop are hidden unconditionally. An
        # instruction can only produce a note and a new draft version; a send
        # reaches a customer, and nothing here may switch that on.
        configure_gateway(gesture: 'a-gesture-secret')
        stub_gateway

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response.parsed_body['capabilities'].keys).to eq(['instruct'])
      end

      it 'asks the gateway for the display_id, not the internal record id' do
        # The two id spaces are different numbers, and the gateway keys its cycles
        # by the display_id that arrives in Chatwoot's own webhook payload. Force
        # them apart so this example can actually tell one from the other.
        # rubocop:disable Rails/SkipsModelValidations
        conversation.update_columns(display_id: conversation.id + 5000)
        # rubocop:enable Rails/SkipsModelValidations
        configure_gateway
        stub_gateway

        get draft_url(conversation.reload.display_id), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:success)
        expect(
          a_request(:post, draft_endpoint).with(query: { secret: gateway_secret },
                                                body: { conversationId: conversation.display_id }.to_json)
        ).to have_been_made
      end

      it 'fails loudly when the gateway url is missing' do
        configure_gateway(url: nil)

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['error']).to eq('AI draft service is not configured')
        expect(a_request(:post, draft_endpoint)).not_to have_been_made
      end

      it 'fails loudly when the gateway secret is missing' do
        configure_gateway(secret: '')

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['error']).to eq('AI draft service is not configured')
        expect(a_request(:post, draft_endpoint)).not_to have_been_made
      end

      it 'returns a clean error when the gateway times out' do
        configure_gateway
        stub_request(:post, draft_endpoint).with(query: { secret: gateway_secret }).to_timeout

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['error']).to eq('AI draft service is unavailable')
        expect(response.body).not_to include(gateway_url)
      end

      it 'returns a clean error when the gateway refuses the read' do
        configure_gateway
        stub_gateway(status: 403, body: { error: 'forbidden' })

        get draft_url, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['error']).to eq('AI draft service is unavailable')
      end
    end
  end
end
