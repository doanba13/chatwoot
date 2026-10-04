require 'rails_helper'

RSpec.describe 'Gotchu Rules API', type: :request do
  let(:account) { create(:account) }
  let(:admin) { create(:user, account: account, role: :administrator) }
  let(:agent) { create(:user, account: account, role: :agent) }
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:rules_endpoint) { "#{gateway_url}/api/rules" }
  let(:sent) { [] }
  let(:rule_params) do
    { title: 'Engraved items ship later', say: 'Say engraved items ship 3 working days after plain ones.',
      sending: 'never_auto', conditions: { v: 1, all: [{ fact: 'line_item_text', op: 'any', value: ['gravur'] }] },
      scope: { store_key: 'persoliebe', inbox_id: nil, except_inbox_ids: [] } }
  end

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

  def rules_url = "/api/v1/accounts/#{account.id}/gotchu/rules"

  before { configure_gateway }

  it 'lets an agent read the list' do
    stub_request(:get, rules_endpoint).with(query: hash_including(secret: gateway_secret))
                                      .to_return(status: 200, body: { rules: [], facts: [] }.to_json)
    get rules_url, headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
  end

  it 'answers the unconfigured shape, not a 502, when the gateway is dark' do
    stub_request(:get, rules_endpoint).with(query: hash_including(secret: gateway_secret))
                                      .to_return(status: 404, body: { error: 'not found' }.to_json)
    get rules_url, headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to eq('rules' => [], 'facts' => [], 'capabilities' => { 'rules' => false })
  end

  it 'refuses an agent a create without calling the gateway' do
    post rules_url, params: rule_params, headers: agent.create_new_auth_token, as: :json
    expect(response).to have_http_status(:unauthorized)
    expect(a_request(:post, rules_endpoint)).not_to have_been_made
  end

  it 'sends the rule in the gateway shape, with the actor from the session' do
    stub_write(rules_endpoint, body: { id: 1, status: 'testing' })
    post rules_url, params: rule_params, headers: admin.create_new_auth_token, as: :json
    expect(sent.last).to include(
      'title' => 'Engraved items ship later', 'sending' => 'never_auto', 'actor' => "chatwoot:#{admin.id}",
      'scope' => { 'storeKey' => 'persoliebe', 'inboxId' => nil, 'exceptInboxIds' => [] }
    )
    expect(sent.last).not_to have_key('status')
  end

  it 'passes the checks through on a refusal' do
    checks = [{ id: 'promise', ok: false, message: 'Promises a discount.' }]
    stub_write(rules_endpoint, status: 400, body: { error: 'invalid', checks: checks })
    post rules_url, params: rule_params, headers: admin.create_new_auth_token, as: :json
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body['checks']).to eq(checks.map(&:stringify_keys))
  end

  it 'answers 409 rule_changed on a stale revision' do
    stub_write("#{rules_endpoint}/1/revisions", status: 409, body: { error: 'rule_changed' })
    put "#{rules_url}/1", params: rule_params.merge(expected_version: 2), headers: admin.create_new_auth_token, as: :json
    expect(response).to have_http_status(:conflict)
    expect(response.parsed_body['reason']).to eq('rule_changed')
  end

  it 'passes a revision answer through whole, demoted bindings included' do
    answer = { rule: { id: 1, version: 3, status: 'active' },
               demoted: [{ procedureId: 7, title: 'Where is my order', channel: 'email' }] }
    stub_write("#{rules_endpoint}/1/revisions", body: answer)
    put "#{rules_url}/1", params: rule_params.merge(expected_version: 2), headers: admin.create_new_auth_token, as: :json
    expect(response.parsed_body).to eq(answer.deep_stringify_keys)
  end

  # Spec §11's replay body is { conditions, scope, days, ruleId?, actor }:
  # nothing else of the rule travels.
  it 'replays with the conditions, scope, days and rule id only' do
    stub_write("#{rules_endpoint}/replay", body: { considered: 40, matched: 37 })
    post "#{rules_url}/replay", params: rule_params.merge(days: 30, rule_id: 4), headers: admin.create_new_auth_token, as: :json
    expect(response).to have_http_status(:ok)
    expect(sent.last.keys).to match_array(%w[conditions scope days ruleId actor])
    expect(sent.last).to include('days' => 30, 'ruleId' => 4, 'actor' => "chatwoot:#{admin.id}")
  end
end
