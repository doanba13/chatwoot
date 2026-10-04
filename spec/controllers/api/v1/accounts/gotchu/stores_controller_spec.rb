require 'rails_helper'

RSpec.describe 'Gotchu store list', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }

  let(:inbox) { create(:inbox, account: account) }

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  before do
    configure_gateway
    create(:inbox_member, user: agent, inbox: inbox)
  end

  def stores_url = "/api/v1/accounts/#{account.id}/gotchu/stores"

  # One store with two inboxes; the agent is a member of the first only.
  def stub_routes(status: 200)
    other = inbox.id + 1000
    body = {
      stores: [{ key: 'persoliebe', name: 'persoliebe', shopEmails: ['kontakt@persoliebe.com'],
                 inboxes: [{ id: inbox.id, channel: 'messenger' }, { id: other, channel: 'web' }] }],
      inboxes: [{ id: inbox.id, name: 'Messenger', channel: 'messenger' }, { id: other, name: 'Web chat', channel: 'web' }]
    }
    stub_request(:get, "#{gateway_url}/api/stores/routes")
      .with(query: hash_including(secret: gateway_secret))
      .to_return(status: status, body: body.to_json)
  end

  it 'gives an agent store keys, names and their own inboxes, and never a shop address' do
    stub_routes
    get stores_url, headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.body).not_to include('kontakt@persoliebe.com')
    expect(response.parsed_body['stores'].first)
      .to eq('key' => 'persoliebe', 'name' => 'persoliebe', 'inboxes' => [{ 'id' => inbox.id, 'channel' => 'messenger' }])
    expect(response.parsed_body['inboxes'].pluck('id')).to eq([inbox.id])
  end

  it 'gives an administrator every inbox, unfiltered' do
    stub_routes
    get stores_url, headers: admin.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['inboxes'].pluck('id')).to eq([inbox.id, inbox.id + 1000])
    expect(response.parsed_body['stores'].first['inboxes'].pluck('id')).to eq([inbox.id, inbox.id + 1000])
    expect(response.parsed_body['capabilities']).to eq('stores' => true)
  end

  it 'answers the unconfigured shape, not a 502, when the gateway is dark' do
    stub_routes(status: 404)
    get stores_url, headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq('stores' => [], 'inboxes' => [], 'capabilities' => { 'stores' => false })
  end
end
