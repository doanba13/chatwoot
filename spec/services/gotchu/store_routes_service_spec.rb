require 'rails_helper'

# Unit-level, mocking HTTParty directly -- the same style
# spec/services/gotchu/procedure_service_spec.rb uses. Everything else about
# this service (the gateway shape, headers, the refusal mapping) is exercised
# end-to-end through store_routes_controller_spec.rb via WebMock; this file
# covers only what a request spec cannot reach: the exact options HTTParty
# was called with, and what a raised transport exception's own message
# carries forward.
RSpec.describe Gotchu::StoreRoutesService do
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gateway_secret) { 'a-shared-secret' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:account_id) { 1 }
  let(:service) { described_class.new(actor_id: 42, account_id: account_id) }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(gateway_url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(gateway_secret)
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture_secret)
  end

  def json_response(code, body)
    instance_double(HTTParty::Response, code: code, body: body.to_json)
  end

  # Task 5 fix round 1: a URI-building exception (SocketError,
  # OpenSSL::SSL::SSLError, ...) can format its own #message from the full
  # request it failed on, query string and all -- which is exactly where the
  # gateway secret lives (`query: { secret: secret }`). Logging or re-raising
  # that message would put a credential in a log line, which this build's own
  # conventions forbid outright (global-constraints.md: "No credential value
  # in any log line, error message or response").
  describe 'transport-error handling' do
    it 'raises UnavailableError carrying only the exception class, never a message that could hold the secret' do
      leaky_message = "getaddrinfo failed for #{gateway_url}/api/stores/routes?secret=#{gateway_secret}"
      allow(HTTParty).to receive(:put).and_raise(SocketError, leaky_message)

      expect { service.replace(stores: []) }.to raise_error(described_class::UnavailableError) do |error|
        expect(error.message).to eq('SocketError')
        expect(error.message).not_to include(gateway_secret)
      end
    end

    it 'still raises UnavailableError, by class, for a plain timeout with no secret-bearing message' do
      allow(HTTParty).to receive(:put).and_raise(Net::ReadTimeout)

      expect { service.replace(stores: []) }.to raise_error(described_class::UnavailableError) do |error|
        expect(error.message).to eq('Net::ReadTimeout')
      end
    end

    # A redirect response would otherwise have HTTParty replay this exact
    # query -- secret included -- against whatever Location header named.
    it 'never follows a redirect, so a redirect target cannot be handed the query secret' do
      response = json_response(200, { stores: [], inboxes: [] })
      expect(HTTParty).to receive(:get).with(anything, hash_including(follow_redirects: false)).and_return(response)

      service.list
    end
  end
end
