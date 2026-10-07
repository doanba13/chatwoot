require 'rails_helper'

RSpec.describe 'Conversation Gotchu context API', type: :request do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:inbox) { create(:inbox, account: account) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:context_url) { "#{gateway_url}/api/context" }
  let(:unavailable) { { 'status' => 'unavailable' } }
  let(:context) do
    { 'conversationId' => conversation.display_id, 'store' => { 'key' => 'persoliebe', 'name' => 'persoliebe' },
      'candidates' => [], 'ambiguous' => false, 'shipping' => unavailable, 'order' => unavailable,
      'refund' => unavailable, 'customer' => unavailable }
  end

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def stub_context
    stub_request(:post, context_url).with(query: { secret: gateway_secret })
  end

  before do
    create(:inbox_member, user: agent, inbox: inbox)
    configure_gateway
  end

  def show(params = {})
    get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/gotchu_context",
        params: params, headers: agent.create_new_auth_token
  end

  it 'asks for the conversation as the signed-in agent, cached by default' do
    stub = stub_context
           .with(body: { conversationId: conversation.display_id, agentId: agent.id, refresh: false }.to_json)
           .to_return(status: 200, body: context.to_json)
    show
    expect(stub).to have_been_requested
    expect(response.parsed_body).to eq(context)
  end

  it 'asks for an uncached read on Refresh' do
    stub = stub_context.with(body: hash_including('refresh' => true)).to_return(status: 200, body: context.to_json)
    show(refresh: '1')
    expect(stub).to have_been_requested
  end

  it 'waits long enough for a live carrier read, on a cold-cache read as on Refresh' do
    expect(HTTParty).to receive(:post).with(context_url, hash_including(timeout: 15)).twice.and_call_original
    stub_context.to_return(status: 200, body: context.to_json)
    show
    show(refresh: '1')
  end

  it 'answers a fixed 502 when the lookup fails' do
    stub_context.to_return(status: 502, body: { error: 'context lookup failed' }.to_json)
    show
    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq('error' => 'Order lookup is unavailable', 'reason' => 'unavailable')
  end

  it 'reads the context without a gesture secret, and sends none' do
    configure_gateway(gesture: nil)
    stub = stub_context.to_return(status: 200, body: context.to_json)
    show
    expect(response).to have_http_status(:ok)
    expect(stub).to have_been_requested
    expect(a_request(:post, %r{/api/context}).with(headers: { 'x-gesture-secret' => /.*/ })).not_to have_been_made
  end

  it 'answers 503 unconfigured only when the gateway URL is missing' do
    configure_gateway(url: nil)
    show
    expect(response).to have_http_status(:service_unavailable)
    expect(response.parsed_body).to eq('error' => 'Order lookup is not configured', 'reason' => 'unconfigured')
  end

  it 'refuses an agent without access to the inbox, and never calls the gateway' do
    stub = stub_context.to_return(status: 200, body: context.to_json)
    get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/gotchu_context",
        headers: create(:user, account: account, role: :agent).create_new_auth_token
    expect(response).to have_http_status(:unauthorized)
    expect(stub).not_to have_been_made
  end
end
