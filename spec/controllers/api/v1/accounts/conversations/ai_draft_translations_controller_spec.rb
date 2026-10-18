require 'rails_helper'

RSpec.describe 'Conversation AI Draft Translations API', type: :request do
  let(:account) { create(:account) }
  let(:conversation) { create(:conversation, account: account) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:translate_endpoint) { "#{gateway_url}/api/translate" }

  before do
    create(:inbox_member, inbox: conversation.inbox, user: agent)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(gateway_url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(gateway_secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return('a-gesture-secret')
  end

  def translation_url(conversation_id = conversation.display_id)
    api_v1_account_conversation_ai_draft_translation_url(account_id: account.id, conversation_id: conversation_id)
  end

  def stub_gateway(status: 200, body: { text: 'Ihre Sendung ist unterwegs.', partial: false })
    stub_request(:post, translate_endpoint)
      .with(query: { secret: gateway_secret })
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def fetch(params = { version: 2, target_language: 'vi' })
    get translation_url, params: params, headers: agent.create_new_auth_token, as: :json
  end

  it 'returns unauthorized without a session and never reaches the gateway' do
    get translation_url, params: { version: 2, target_language: 'vi' }, as: :json

    expect(response).to have_http_status(:unauthorized)
    expect(a_request(:post, translate_endpoint)).not_to have_been_made
  end

  it 'passes the session account, never a param' do
    other = create(:account)
    stub = stub_gateway
    allow(Gotchu::GatewayClient).to receive(:new).and_call_original

    fetch(version: 2, target_language: 'vi', account_id: other.id)

    expect(response).to have_http_status(:success)
    expect(Gotchu::GatewayClient).to have_received(:new).with(account_id: account.id)
    sent = ->(req) { JSON.parse(req.body).values_at('kind', 'conversationId', 'version', 'target') }
    expect(stub.with { |req| sent.call(req) == ['draft', conversation.display_id, 2, 'vi'] }).to have_been_requested
    expect(response.parsed_body).to eq('text' => 'Ihre Sendung ist unterwegs.', 'partial' => false, 'version' => 2)
  end

  it 'answers 409 when the gateway says stale' do
    stub_gateway(status: 409, body: { error: 'stale' })

    fetch

    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body).to eq('error' => 'stale')
  end

  it 'answers 422 for an unsupported language without reaching the gateway' do
    fetch(version: 2, target_language: 'xx')

    expect(response).to have_http_status(:unprocessable_entity)
    expect(a_request(:post, translate_endpoint)).not_to have_been_made
  end

  it 'answers 422 for a missing version' do
    fetch(target_language: 'vi')

    expect(response).to have_http_status(:unprocessable_entity)
    expect(a_request(:post, translate_endpoint)).not_to have_been_made
  end

  it 'answers 422 when the gateway cannot translate' do
    stub_gateway(status: 503, body: {})

    fetch

    expect(response).to have_http_status(:unprocessable_entity)
  end
end
