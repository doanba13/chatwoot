require 'rails_helper'

# Unit-level, mocking HTTParty directly -- the same style
# spec/services/tiktok/client_spec.rb already uses for an HTTParty-backed
# client, rather than the request-spec style
# procedures_controller_spec.rb uses (which stubs the HTTP boundary via
# WebMock, one layer further out). Task 13 only: bindings/set_binding.
# The other five ProcedureService methods (list/create/revise/set_status/
# replay) are exercised end-to-end through the controller spec already and
# are left alone here.
RSpec.describe Gotchu::ProcedureService do
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

  describe '#bindings' do
    it 'issues a GET to /api/procedures/:id/bindings with both credentials' do
      response = json_response(200, { bindings: [] })
      expect(HTTParty).to receive(:get).with(
        "#{gateway_url}/api/procedures/7/bindings",
        hash_including(
          query: { secret: gateway_secret },
          headers: { 'x-gesture-secret' => gesture_secret, 'X-Chatwoot-Account-Id' => account_id.to_s }
        )
      ).and_return(response)

      expect(service.bindings(id: 7)).to eq('bindings' => [])
    end

    it 'raises NotFoundError on a 404' do
      allow(HTTParty).to receive(:get).and_return(json_response(404, { error: 'no such procedure' }))

      expect { service.bindings(id: 7) }.to raise_error(Gotchu::ProcedureService::NotFoundError)
    end

    it 'raises UnavailableError on a status this route does not claim' do
      allow(HTTParty).to receive(:get).and_return(json_response(500, { error: 'boom' }))

      expect { service.bindings(id: 7) }.to raise_error(Gotchu::ProcedureService::UnavailableError)
    end
  end

  describe '#set_binding' do
    it 'issues a PUT to /api/procedures/:id/bindings/:channel with tier, actor and expectedVersion only' do
      # The gateway wraps its response as `{ binding: {...} }` -- this
      # service is a plain proxy and does NOT unwrap it; `set_binding`
      # returns whatever `parse` hands back, `binding` key and all.
      # ChannelTiers.vue is the one that reads `.binding` off the result.
      response = json_response(200, { binding: { procedureId: 7, channel: 'email', tier: 'auto', authorisedVersion: 5,
                                                   setBy: 'chatwoot:42', setAt: '2026-09-23T00:00:00Z' } })
      expect(HTTParty).to receive(:put) do |url, options|
        expect(url).to eq("#{gateway_url}/api/procedures/7/bindings/email")
        expect(options[:query]).to eq(secret: gateway_secret)
        expect(options[:headers]).to eq('x-gesture-secret' => gesture_secret,
                                         'X-Chatwoot-Account-Id' => account_id.to_s,
                                         'Content-Type' => 'application/json')
        body = JSON.parse(options[:body])
        expect(body.keys).to contain_exactly('tier', 'actor', 'expectedVersion')
        expect(body).to eq('tier' => 'auto', 'actor' => 'chatwoot:42', 'expectedVersion' => 5)
        response
      end

      result = service.set_binding(id: 7, channel: 'email', tier: 'auto', expected_version: 5)

      expect(result).to eq(
        'binding' => { 'procedureId' => 7, 'channel' => 'email', 'tier' => 'auto', 'authorisedVersion' => 5,
                        'setBy' => 'chatwoot:42', 'setAt' => '2026-09-23T00:00:00Z' }
      )
    end

    it 'relays a `binding: null` response verbatim when the write turned the channel off' do
      response = json_response(200, { binding: nil })
      allow(HTTParty).to receive(:put).and_return(response)

      result = service.set_binding(id: 7, channel: 'email', tier: nil, expected_version: 5)

      expect(result).to eq('binding' => nil)
    end

    it 'sends an explicit tier: null to turn a channel off, never dropping the key' do
      response = json_response(200, {})
      expect(HTTParty).to receive(:put) do |_url, options|
        body = JSON.parse(options[:body])
        expect(body).to have_key('tier')
        expect(body['tier']).to be_nil
        response
      end

      service.set_binding(id: 7, channel: 'email', tier: nil, expected_version: 5)
    end

    it 'never sends authorisedVersion or a bare version -- only expectedVersion carries the precondition' do
      response = json_response(200, {})
      expect(HTTParty).to receive(:put) do |_url, options|
        body = JSON.parse(options[:body])
        expect(body).not_to have_key('authorisedVersion')
        expect(body).not_to have_key('version')
        response
      end

      service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5)
    end

    it 'raises ValidationError on a 400' do
      allow(HTTParty).to receive(:put).and_return(json_response(400, { error: 'unknown channel' }))

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::ValidationError)
    end

    it 'raises NotFoundError on a 404' do
      allow(HTTParty).to receive(:put).and_return(json_response(404, { error: 'no such procedure' }))

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::NotFoundError)
    end

    it 'raises StaleVersionError when the gateway says the procedure changed since the version sent' do
      allow(HTTParty).to receive(:put)
        .and_return(json_response(409, { error: 'the procedure changed since you opened it' }))

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::StaleVersionError)
    end

    it 'raises NotActiveForAutoError when the gateway refuses to raise a channel to auto on a non-active procedure' do
      allow(HTTParty).to receive(:put)
        .and_return(json_response(409, { error: 'only an active procedure can be raised to auto' }))

      expect { service.set_binding(id: 7, channel: 'email', tier: 'auto', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::NotActiveForAutoError)
    end

    it 'raises UnavailableError, not a fabricated conflict reason, on a 409 body this build does not recognise' do
      allow(HTTParty).to receive(:put)
        .and_return(json_response(409, { error: 'some future reason nobody wrote a case for' }))

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::UnavailableError)
    end

    it 'raises UnavailableError, rather than a TypeError, on a 409 body that parses but is not an object' do
      response = instance_double(HTTParty::Response, code: 409, body: [1, 2, 3].to_json)
      allow(HTTParty).to receive(:put).and_return(response)

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::UnavailableError)
    end

    it 'raises UnavailableError when the gateway does not answer at all' do
      allow(HTTParty).to receive(:put).and_raise(Net::ReadTimeout)

      expect { service.set_binding(id: 7, channel: 'email', tier: 'draft', expected_version: 5) }
        .to raise_error(Gotchu::ProcedureService::UnavailableError)
    end
  end

  # Task 11: the gateway becomes multi-tenant, so this proxy must send the
  # calling account's own secret rather than one shared by everyone. The
  # parser itself (`Gotchu::GatewaySecret.parse`) is shared by every
  # gateway-calling class and tested once, in gateway_secret_spec.rb. This
  # block is ProcedureService's own use of it: end-to-end behaviour (which
  # secret and header actually leave the process) is covered by
  # procedures_controller_spec.rb; this is the resolver wired into `#list`.
  describe 'account-scoped gateway secret (#list, exercising the resolver every method shares)' do
    it "sends the account's own secret when GOTCHU_GATEWAY_SECRETS names one, not the shared variable" do
      own_secret = 'only-for-account-1'
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return("#{account_id}:#{own_secret}")
      response = json_response(200, { procedures: [] })
      expect(HTTParty).to receive(:get).with(anything, hash_including(query: { secret: own_secret })).and_return(response)

      service.list
    end

    it 'falls back to the single GOTCHU_GATEWAY_SECRET for an account the map does not list' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('999:someone-elses-secret')
      response = json_response(200, { procedures: [] })
      expect(HTTParty).to receive(:get).with(anything, hash_including(query: { secret: gateway_secret })).and_return(response)

      service.list
    end

    it 'raises ConfigurationError, and makes no request, when neither the map nor the fallback name the account' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('999:someone-elses-secret')
      expect(HTTParty).not_to receive(:get)

      expect { service.list }.to raise_error(Gotchu::ProcedureService::ConfigurationError)
    end
  end

  # Coordinator ruling, Task 11 follow-up: `available?` must answer from
  # per-account resolution, not the single global variable alone -- an
  # account named only in GOTCHU_GATEWAY_SECRETS, with no install-wide
  # fallback, is genuinely available even though the old single-variable
  # check would have said otherwise.
  describe '.available?' do
    it 'is true for an account named only in the per-account map, with no single fallback secret set' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return("#{account_id}:only-for-this-account")

      expect(described_class.available?(account_id: account_id)).to be(true)
    end

    it 'is false for an account the map does not list, with no single fallback secret set' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('999:someone-elses-secret')

      expect(described_class.available?(account_id: account_id)).to be(false)
    end

    it 'is true for an unlisted account via the single fallback secret, as before' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(gateway_secret)
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)

      expect(described_class.available?(account_id: account_id)).to be(true)
    end

    it 'is still false when the gateway URL or the gesture secret is missing, even with an account secret' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return("#{account_id}:only-for-this-account")
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(nil)

      expect(described_class.available?(account_id: account_id)).to be(false)
    end
  end
end
