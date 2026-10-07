require 'rails_helper'

RSpec.describe 'Conversation Gotchu thread API', type: :request do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:inbox) { create(:inbox, account: account) }
  let(:conversation) { create(:conversation, account: account, inbox: inbox) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:sent_item) do
    { 'messageId' => 501, 'cycleId' => 12, 'version' => 1, 'edited' => false,
      'author' => 'model', 'sentBy' => 'agent', 'trace' => [{ 'kind' => 'tier', 'tier' => 'draft', 'channel' => 'email', 'refusal' => nil }] }
  end
  let(:timeline_item) { { 'at' => '2026-09-30T07:15:00.000Z', 'kind' => 'drafted', 'version' => 1, 'procedureTitle' => 'Where is my order' } }

  def configure_gateway(url: gateway_url, secret: gateway_secret, gesture: gesture_secret, secrets: nil)
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(secrets)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture)
  end

  def stub_leaf(leaf, **response)
    stub_request(:get, "#{gateway_url}/api/conversations/#{conversation.display_id}/#{leaf}")
      .with(query: { secret: gateway_secret }).to_return(response)
  end

  before do
    create(:inbox_member, user: agent, inbox: inbox)
    configure_gateway
  end

  def show
    get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/gotchu_thread",
        headers: agent.create_new_auth_token, as: :json
  end

  it 'passes both lists through unchanged' do
    stub_leaf('sent-drafts', status: 200, body: { items: [sent_item] }.to_json)
    stub_leaf('timeline', status: 200, body: { items: [timeline_item] }.to_json)
    show
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq('sentDrafts' => [sent_item], 'timeline' => [timeline_item], 'available' => true)
  end

  it 'answers empty lists when the gateway predates the routes' do
    stub_leaf('sent-drafts', status: 404, body: { error: 'not found' }.to_json)
    stub_leaf('timeline', status: 404, body: { error: 'not found' }.to_json)
    show
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq('sentDrafts' => [], 'timeline' => [], 'available' => false)
  end

  it 'answers empty lists, not a 503, when the gateway is not configured' do
    configure_gateway(url: nil)
    show
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body['available']).to be(false)
  end

  it 'answers 502 with a fixed message when the gateway is down, never its text' do
    stub_request(:get, %r{/sent-drafts}).to_raise(Errno::ECONNREFUSED)
    stub_leaf('timeline', status: 200, body: { items: [] }.to_json)
    show
    expect(response).to have_http_status(:bad_gateway)
    expect(response.parsed_body).to eq('error' => 'Gotchu thread is unavailable', 'reason' => 'unavailable')
  end

  it 'drops a non-array items field rather than passing it on' do
    stub_leaf('sent-drafts', status: 200, body: { items: 'x' }.to_json)
    stub_leaf('timeline', status: 200, body: {}.to_json)
    show
    expect(response.parsed_body.slice('sentDrafts', 'timeline')).to eq('sentDrafts' => [], 'timeline' => [])
  end

  it 'never reaches the gateway for a conversation in another account' do
    # Another account's real conversation, by its own display id: the id
    # exists, just not in this account, so the 404 proves scoping rather than
    # a missing row. Display ids restart per account, so make sure this one
    # is not also a conversation of `account`.
    other = create(:conversation, account: create(:account))
    expect(account.conversations.find_by(display_id: other.display_id)).to be_nil
    get "/api/v1/accounts/#{account.id}/conversations/#{other.display_id}/gotchu_thread",
        headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:not_found)
    expect(a_request(:get, /sent-drafts|timeline/)).not_to have_been_made
  end
end
