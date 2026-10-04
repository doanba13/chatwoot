require 'rails_helper'

RSpec.describe 'Gotchu Memos API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:memos_endpoint) { "#{gateway_url}/api/memos" }
  let(:sent) { [] }
  let(:conversation) { create(:conversation, account: account) }
  let(:engraved) { { text: 'Engraved items ship 3 working days later.', kind: 'standing_fact' } }

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

  def stub_put(url, status: 200, body: {})
    stub_request(:put, url)
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: status, body: body.to_json, headers: { 'Content-Type' => 'application/json' })
  end

  def memos_url = "/api/v1/accounts/#{account.id}/gotchu/memos"

  before { configure_gateway }

  it 'lets an agent add a memo, with the actor from the session' do
    stub_write(memos_endpoint, body: { id: 5 })
    post memos_url, params: { text: 'Christmas orders close on 15 December.', kind: 'standing_fact',
                              scope: { store_key: 'giftera' }, until: '2026-12-16' },
                    headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(sent.last).to include('actor' => "chatwoot:#{agent.id}", 'kind' => 'standing_fact',
                                 'scope' => { 'storeKey' => 'giftera', 'inboxId' => nil }, 'until' => '2026-12-16')
  end

  # Spec §11: on the screen path the scope is required, and the gateway says
  # so. An absent scope must reach it absent, never as all stores.
  # Strong parameters: only text, kind, until and the scope's two fields
  # reach the gateway; anything else, or a non-scalar in their place, is dropped.
  it 'never forwards a field the memo does not have' do
    stub_write(memos_endpoint, body: { id: 11 })
    post memos_url, params: { text: { nested: 'x' }, kind: 'standing_fact', until: ['2026-12-16'], source: 'proposal',
                              author: 'chatwoot:1', scope: { store_key: 'giftera', inbox_id: 3, extra: 1 } },
                    headers: agent.create_new_auth_token, as: :json
    expect(sent.last.keys).to match_array(%w[kind scope actor])
    expect(sent.last['scope']).to eq('storeKey' => 'giftera', 'inboxId' => 3)
  end

  it 'never invents a scope the caller did not send' do
    stub_write(memos_endpoint, body: { id: 9 })
    post memos_url, params: { text: 'Orders ship from Shenzhen.', kind: 'standing_fact' },
                    headers: agent.create_new_auth_token, as: :json
    expect(sent.last).not_to have_key('scope')
  end

  it 'forwards an explicit all-stores scope from the composer' do
    create(:inbox_member, user: agent, inbox: conversation.inbox)
    stub_write(memos_endpoint, body: { id: 10 })
    post memos_url, params: engraved.merge(conversation_id: conversation.display_id, scope: { store_key: nil }),
                    headers: agent.create_new_auth_token, as: :json
    expect(sent.last).to include('scope' => { 'storeKey' => nil, 'inboxId' => nil })
  end

  it 'forwards a conversation the agent may open, and never a body store for it' do
    create(:inbox_member, user: agent, inbox: conversation.inbox)
    stub_write(memos_endpoint, body: { id: 6 })
    post memos_url, params: engraved.merge(conversation_id: conversation.display_id),
                    headers: agent.create_new_auth_token, as: :json
    expect(sent.last).to include('conversationId' => conversation.display_id)
    expect(sent.last).not_to have_key('scope')
  end

  it 'refuses a composer memo on a conversation the agent cannot open, without calling the gateway' do
    stub_write(memos_endpoint, body: { id: 6 })
    post memos_url, params: engraved.merge(conversation_id: conversation.display_id),
                    headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(a_request(:post, memos_endpoint)).not_to have_been_made
  end

  it 'answers 404 for a conversation outside the account, without calling the gateway' do
    other = create(:conversation)
    stub_write(memos_endpoint, body: { id: 6 })
    post memos_url, params: engraved.merge(conversation_id: other.display_id + 1000),
                    headers: admin.create_new_auth_token, as: :json
    expect(response).to have_http_status(:not_found)
    expect(a_request(:post, memos_endpoint)).not_to have_been_made
  end

  describe 'the conversation a memo came from' do
    let(:theirs) { create(:conversation, account: account) }

    def memo_view(id, conversation)
      { id: id, kind: 'standing_fact', text: 'Engraved items ship later.', scope: { storeKey: 'persoliebe', inboxId: nil },
        expiresAt: nil, origin: { source: 'composer', author: 'chatwoot:4', conversationId: conversation.display_id },
        editedBy: nil, targetMissing: false }
    end

    before do
      create(:inbox_member, user: agent, inbox: conversation.inbox)
      stub_request(:get, memos_endpoint).with(query: hash_including(secret: gateway_secret))
                                        .to_return(status: 200, body: { memos: [memo_view(1, conversation), memo_view(2, theirs)],
                                                                        proposalsPending: 0 }.to_json)
    end

    it 'drops the conversation of a memo the agent may not open, and keeps the memo' do
      get memos_url, headers: agent.create_new_auth_token, as: :json
      memos = response.parsed_body['memos']
      expect(memos.pluck('id')).to eq([1, 2])
      expect(memos.map { |m| m['origin']['conversationId'] }).to eq([conversation.display_id, nil])
      expect(memos.last['origin']).to include('source' => 'composer', 'author' => 'chatwoot:4')
    end

    it 'keeps every conversation for an administrator' do
      get memos_url, headers: admin.create_new_auth_token, as: :json
      expect(response.parsed_body['memos'].map { |m| m['origin']['conversationId'] }).to eq([conversation.display_id, theirs.display_id])
    end

    it 'drops it from the memo an edit answers with too' do
      stub_put("#{memos_endpoint}/2", body: memo_view(3, theirs))
      put "#{memos_url}/2", params: { text: 'Engraved items ship three days later.', kind: 'standing_fact' },
                            headers: agent.create_new_auth_token, as: :json
      expect(response.parsed_body['origin']).to include('conversationId' => nil, 'source' => 'composer')
    end
  end

  it 'passes scope_required through, so the Memo tab can say why' do
    create(:inbox_member, user: agent, inbox: conversation.inbox)
    stub_write(memos_endpoint, status: 400, body: { error: 'scope_required' })
    post memos_url, params: engraved.merge(conversation_id: conversation.display_id),
                    headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body['reason']).to eq('scope_required')
  end

  it 'answers the unconfigured shape, not a 502, when the gateway is dark' do
    stub_request(:get, memos_endpoint).with(query: hash_including(secret: gateway_secret))
                                      .to_return(status: 404, body: { error: 'not found' }.to_json)
    get memos_url, headers: agent.create_new_auth_token, as: :json
    expect(response.parsed_body).to eq('memos' => [], 'proposalsPending' => 0, 'capabilities' => { 'memos' => false })
  end

  it 'answers 409 memo_changed when the memo was edited elsewhere' do
    stub_put("#{memos_endpoint}/5", status: 409, body: { error: 'memo_changed' })
    put "#{memos_url}/5", params: { text: 'x', kind: 'style' }, headers: agent.create_new_auth_token, as: :json
    expect(response.parsed_body['reason']).to eq('memo_changed')
  end

  it 'revokes a memo with the actor in the body and answers no content' do
    stub_request(:delete, "#{memos_endpoint}/5")
      .with(query: { secret: gateway_secret }) do |request|
        sent << JSON.parse(request.body)
        true
      end
      .to_return(status: 204, body: '')
    delete "#{memos_url}/5", headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:no_content)
    expect(sent.last).to eq('actor' => "chatwoot:#{agent.id}")
  end

  it 'decides a proposal, and says so when someone else already did' do
    stub_write("#{gateway_url}/api/memo-proposals/9/decision", status: 409, body: { error: 'already_decided' })
    post "/api/v1/accounts/#{account.id}/gotchu/memo_proposals/9/decision", params: { decision: 'confirm' },
                                                                            headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body['reason']).to eq('already_decided')
  end

  it 'refuses a decision other than confirm or dismiss without calling the gateway' do
    post "/api/v1/accounts/#{account.id}/gotchu/memo_proposals/9/decision", params: { decision: 'maybe' },
                                                                            headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(a_request(:post, "#{gateway_url}/api/memo-proposals/9/decision")).not_to have_been_made
  end
end
