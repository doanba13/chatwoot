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

  it 'lets an agent stop an auto send, attributed to them' do
    stub_write("#{gateway_url}/api/cycles/31/auto/stop", body: { ok: true })
    post "/api/v1/accounts/#{account.id}/gotchu/cycles/31/stop_auto", headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(sent.last).to eq('actor' => "chatwoot:#{agent.id}")
  end

  it 'says not_holding when the send already went or was stopped' do
    stub_write("#{gateway_url}/api/cycles/31/auto/stop", status: 409, body: { error: 'not_holding' })
    post "/api/v1/accounts/#{account.id}/gotchu/cycles/31/stop_auto", headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body['reason']).to eq('not_holding')
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
