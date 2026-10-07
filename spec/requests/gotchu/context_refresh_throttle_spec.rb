require 'rails_helper'

RSpec.describe 'Gotchu context refresh throttle', type: :request do
  let(:throttle) { Rack::Attack.throttles['/api/v1/accounts/:account_id/conversations/:id/gotchu_context refresh'] }
  let(:path) { '/api/v1/accounts/7/conversations/42/gotchu_context' }

  def key_for(path, verb = 'GET', headers = {})
    env = Rack::MockRequest.env_for(path, { 'REQUEST_METHOD' => verb, 'REMOTE_ADDR' => '203.0.113.9' }.merge(headers))
    throttle.block.call(Rack::Attack::Request.new(env))
  end

  it 'limits refreshes to six a minute by default' do
    expect(throttle.limit).to eq(6)
    expect(throttle.period).to eq(1.minute)
  end

  it 'keys a refresh by the signed-in user and the account' do
    expect(key_for("#{path}?refresh=1", 'GET', 'HTTP_UID' => 'agent@example.com')).to eq('agent@example.com:7')
    expect(key_for("#{path}?refresh=true", 'GET', 'HTTP_API_ACCESS_TOKEN' => 'tok')).to eq('tok:7')
  end

  it 'falls back to the IP when the request names no user' do
    expect(key_for("#{path}?refresh=1")).to eq('203.0.113.9')
  end

  it 'leaves a cached read, another verb and another path alone' do
    expect(key_for(path, 'GET', 'HTTP_UID' => 'agent@example.com')).to be_nil
    expect(key_for("#{path}?refresh=0", 'GET', 'HTTP_UID' => 'agent@example.com')).to be_nil
    expect(key_for("#{path}?refresh=1", 'POST', 'HTTP_UID' => 'agent@example.com')).to be_nil
    expect(key_for('/api/v1/accounts/7/conversations/42/gotchu_thread?refresh=1', 'GET', 'HTTP_UID' => 'a')).to be_nil
  end
end
