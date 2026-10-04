require 'rails_helper'

RSpec.describe Gotchu::GatewayClient do
  let(:account) { create(:account) }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return('http://gateway.test:8137')
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('a-shared-secret')
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return('a-gesture-secret')
  end

  it 'raises the checks error with the gateway checks on a 400' do
    body = { error: 'invalid', checks: [{ id: 'length', ok: false, message: 'Too long.' }] }
    stub_request(:post, 'http://gateway.test:8137/api/rules')
      .with(query: hash_including({}))
      .to_return(status: 400, body: body.to_json)
    client = described_class.new(account_id: account.id)
    expect { client.request(verb: :post, path: '/api/rules', body: {}, checks_error: Gotchu::RuleService::InvalidError) }
      .to raise_error(Gotchu::RuleService::InvalidError) { |e| expect(e.checks.first['id']).to eq('length') }
  end
end
