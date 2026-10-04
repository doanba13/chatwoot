require 'rails_helper'

RSpec.describe 'Gotchu Agent API', type: :request do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:sent) { [] }

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def stub_write(url, status: 200, body: {})
    stub_request(:post, url)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  before { configure_gateway }

  describe 'the Stop' do
    let(:admin) { create(:user, account: account, role: :administrator) }
    let(:conversation) { create(:conversation, account: account) }
    let(:stop_endpoint) { "#{gateway_url}/api/cycles/31/auto/stop" }

    def stop_url = "/api/v1/accounts/#{account.id}/gotchu/cycles/31/stop_auto"

    it 'lets an agent who may open the conversation stop it, attributed to them and naming it' do
      create(:inbox_member, user: agent, inbox: conversation.inbox)
      stub_write(stop_endpoint, body: { ok: true })
      post stop_url, params: { conversation_id: conversation.display_id }, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:ok)
      expect(sent.last).to eq('actor' => "chatwoot:#{agent.id}", 'conversationId' => conversation.display_id)
    end

    it 'lets an administrator stop any conversation of the account' do
      stub_write(stop_endpoint, body: { ok: true })
      post stop_url, params: { conversation_id: conversation.display_id }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:ok)
      expect(sent.last).to eq('actor' => "chatwoot:#{admin.id}", 'conversationId' => conversation.display_id)
    end

    it 'refuses an agent who cannot open the conversation, and never calls the gateway' do
      stop = stub_write(stop_endpoint, body: { ok: true })
      post stop_url, params: { conversation_id: conversation.display_id }, headers: agent.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unauthorized)
      expect(stop).not_to have_been_requested
    end

    it 'refuses a Stop that names no conversation, and never calls the gateway' do
      stop = stub_write(stop_endpoint, body: { ok: true })
      post stop_url, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(stop).not_to have_been_requested
    end

    it 'answers a conversation of another account as not found, and never calls the gateway' do
      elsewhere = create(:conversation)
      stop = stub_write(stop_endpoint, body: { ok: true })
      post stop_url, params: { conversation_id: elsewhere.display_id }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:not_found)
      expect(stop).not_to have_been_requested
    end

    it 'says not_holding when the send already went or was stopped' do
      stub_write(stop_endpoint, status: 409, body: { error: 'not_holding' })
      post stop_url, params: { conversation_id: conversation.display_id }, headers: admin.create_new_auth_token, as: :json
      expect(response).to have_http_status(:conflict)
      expect(response.parsed_body['reason']).to eq('not_holding')
    end
  end

  describe 'conversation ids in the overview' do
    let(:admin) { create(:user, account: account, role: :administrator) }
    let(:mine) { create(:conversation, account: account) }
    let(:theirs) { create(:conversation, account: account) }

    def hold(conversation, cycle_id)
      { cycleId: cycle_id, conversationId: conversation.display_id, procedureTitle: 'Where is my order',
        channel: 'email', firesAt: '2026-10-05T10:00:00Z' }
    end

    before do
      create(:inbox_member, user: agent, inbox: mine.inbox)
      stub_request(:get, "#{gateway_url}/api/agent/overview").with(query: hash_including(secret: gateway_secret))
                                                             .to_return(status: 200, body: {
                                                               procedures: [], proposalsPending: 0, rulesActive: 0,
                                                               holding: [hold(mine, 31), hold(theirs, 32)],
                                                               noMatch: { count: 2, conversationIds: [mine.display_id, theirs.display_id] }
                                                             }.to_json)
    end

    it 'shows an agent only the holds and unmatched conversations they may open' do
      get "/api/v1/accounts/#{account.id}/gotchu/agent/overview", headers: agent.create_new_auth_token, as: :json
      expect(response.parsed_body['holding'].pluck('cycleId')).to eq([31])
      expect(response.parsed_body['noMatch']['conversationIds']).to eq([mine.display_id])
    end

    it 'shows an agent outside every inbox none of them' do
      outsider = create(:user, account: account, role: :agent)
      get "/api/v1/accounts/#{account.id}/gotchu/agent/overview", headers: outsider.create_new_auth_token, as: :json
      expect(response.parsed_body['holding']).to eq([])
      expect(response.parsed_body['noMatch']['conversationIds']).to eq([])
    end

    it 'shows an administrator all of them' do
      get "/api/v1/accounts/#{account.id}/gotchu/agent/overview", headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body['holding'].pluck('cycleId')).to eq([31, 32])
      expect(response.parsed_body['noMatch']['conversationIds']).to eq([mine.display_id, theirs.display_id])
    end
  end

  it 'answers the unconfigured shape, not a 502, when the gateway is dark' do
    stub_request(:get, "#{gateway_url}/api/agent/overview").with(query: hash_including(secret: gateway_secret))
                                                           .to_return(status: 404, body: { error: 'not found' }.to_json)
    get "/api/v1/accounts/#{account.id}/gotchu/agent/overview", headers: agent.create_new_auth_token, as: :json
    expect(response.parsed_body).to eq('capabilities' => { 'overview' => false })
  end

  it 'reads the overview for the days asked, readable by an agent' do
    read = stub_request(:get, "#{gateway_url}/api/agent/overview")
           .with(query: hash_including(secret: gateway_secret, days: '7'))
           .to_return(status: 200, body: { procedures: [], holding: [], proposalsPending: 0, rulesActive: 0 }.to_json)
    get "/api/v1/accounts/#{account.id}/gotchu/agent/overview", params: { days: 7 }, headers: agent.create_new_auth_token
    expect(read).to have_been_made
    expect(response.parsed_body).to include('holding' => [], 'capabilities' => { 'overview' => true })
  end
end
