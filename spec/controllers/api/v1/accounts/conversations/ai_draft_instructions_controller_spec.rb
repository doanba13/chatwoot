require 'rails_helper'

RSpec.describe 'Conversation AI Draft Instructions API', type: :request do
  let(:account) { create(:account) }
  let(:conversation) { create(:conversation, account: account) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:instruct_endpoint) { "#{gateway_url}/api/instruct" }
  let(:request_id) { 'b7c0e2a1-3f4d-4c2b-9a1e-0d5f6a7b8c9d' }
  let(:text) { 'Bitte die Sendungsnummer zuerst nennen.' }
  let(:params) { { cycle_id: 2964, request_id: request_id, text: text } }
  # Every body the gateway was actually sent, parsed. Captured in the stub's own
  # matcher rather than reconstructed afterwards, so an assertion about what
  # travelled is about the request that travelled.
  let(:sent) { [] }

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def instruct_url(conversation_id = conversation.display_id)
    api_v1_account_conversation_ai_draft_instruction_url(account_id: account.id, conversation_id: conversation_id)
  end

  def stub_gateway(status: 202, body: { queued: true })
    stub_request(:post, instruct_endpoint)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def forwarded_body
    sent.last
  end

  describe 'POST /api/v1/accounts/{account.id}/conversations/{conversation.display_id}/ai_draft_instruction' do
    context 'when it is an unauthenticated user' do
      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        post instruct_url, params: params, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end
    end

    context 'when the user belongs to another account' do
      let(:other_agent) { create(:user, account: create(:account), role: :administrator) }

      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        post instruct_url, params: params, headers: other_agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end
    end

    context 'when the agent has no access to the conversation inbox' do
      let(:outsider) { create(:user, account: account, role: :agent) }

      it 'returns unauthorized and never reaches the gateway' do
        configure_gateway

        post instruct_url, params: params, headers: outsider.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unauthorized)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end
    end

    context 'when it is an authenticated agent with access to the inbox' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'accepts the instruction and says only that' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:accepted)
        expect(response.parsed_body).to eq({ 'status' => 'accepted' })
      end

      it 'forwards exactly what the gateway takes on this route' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        # No draftVersion, and that is not an omission: the instruct route REFUSES
        # one. A redraft pins nothing, and the draft it produces still has to be
        # reviewed before anyone sends it.
        expect(forwarded_body.keys).to contain_exactly('conversationId', 'cycleId', 'actorId', 'requestId', 'text')
        expect(forwarded_body).to include(
          'conversationId' => conversation.display_id,
          'cycleId' => 2964,
          'requestId' => request_id,
          'text' => text
        )
      end

      it 'sends the session agent as the actor, not a number off the wire' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        # Invariant 5 in one assertion: the gesture is attributable because the
        # actor is the signed-in user. As a string of digits, which is the only
        # shape the gateway's AGENT_ID_RE accepts.
        expect(forwarded_body['actorId']).to eq(agent.id.to_s)
      end

      it 'ignores an actor supplied in the body' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(actor_id: 999_999, actorId: 999_999),
                           headers: agent.create_new_auth_token, as: :json

        expect(forwarded_body['actorId']).to eq(agent.id.to_s)
        expect(response.body).not_to include('999999')
      end

      it 'asks about the display_id, not the internal record id' do
        # The gateway verifies the cycle against the conversation it was named
        # with, so the wrong id space is a refusal rather than a wrong answer.
        # rubocop:disable Rails/SkipsModelValidations
        conversation.update_columns(display_id: conversation.id + 5000)
        # rubocop:enable Rails/SkipsModelValidations
        configure_gateway
        stub_gateway

        post instruct_url(conversation.reload.display_id),
             params: params, headers: agent.create_new_auth_token, as: :json

        expect(forwarded_body['conversationId']).to eq(conversation.display_id)
      end

      it 'carries the gesture credential in the header, never in the query string' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(
          a_request(:post, instruct_endpoint)
            .with(query: { secret: gateway_secret },
                  headers: { 'x-gesture-secret' => gesture_secret, 'Content-Type' => 'application/json' })
        ).to have_been_made
      end

      it 'forwards the instruction trimmed, so the length it checked is the length it sent' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(text: "  #{text}\n"), headers: agent.create_new_auth_token, as: :json

        expect(forwarded_body['text']).to eq(text)
      end

      it 'refuses an instruction longer than the gateway accepts' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(text: 'a' * 2001), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['reason']).to eq('invalid')
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end

      it 'accepts an instruction of exactly the maximum length' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(text: 'a' * 2000), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:accepted)
      end

      it 'refuses an instruction that is only whitespace' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(text: "  \n "), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end

      it 'refuses a request id the gateway would reject' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(request_id: 'has:a:colon'), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end

      it 'refuses a cycle id that is not a positive integer' do
        configure_gateway
        stub_gateway

        post instruct_url, params: params.merge(cycle_id: 0), headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end

      it 'says it is not configured when the gesture credential is missing' do
        configure_gateway(gesture: nil)

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['reason']).to eq('unconfigured')
        expect(a_request(:post, instruct_endpoint)).not_to have_been_made
      end

      it 'says it is not configured when the gateway url is missing' do
        configure_gateway(url: nil)

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:service_unavailable)
        expect(response.parsed_body['reason']).to eq('unconfigured')
      end

      it 'could not confirm, rather than failed, when the gateway does not answer' do
        configure_gateway
        stub_request(:post, instruct_endpoint).with(query: { secret: gateway_secret }).to_timeout

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.parsed_body['reason']).to eq('unavailable')
        expect(response.parsed_body['error']).to eq('Gotchu did not confirm the instruction')
      end

      it 'leaks neither the gateway address nor its status code' do
        configure_gateway
        stub_gateway(status: 403, body: { error: 'forbidden' })

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:bad_gateway)
        expect(response.body).not_to include(gateway_url)
        expect(response.body).not_to include('403')
        expect(response.body).not_to include('forbidden')
      end

      it 'reports a refusal as a refusal, which a supporter can act on' do
        configure_gateway
        stub_gateway(status: 400, body: { error: 'invalid cycleId' })

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('refused')
      end

      it 'reports an unknown cycle as a refusal too' do
        # 404 is ambiguous at the far end on purpose: no such cycle, or a write
        # surface that is switched off. Both are refusals here, in words that fit
        # either — never a cause nobody observed.
        configure_gateway
        stub_gateway(status: 404, body: { error: 'not found' })

        post instruct_url, params: params, headers: agent.create_new_auth_token, as: :json

        expect(response).to have_http_status(:conflict)
        expect(response.parsed_body['reason']).to eq('refused')
      end
    end
  end
end
