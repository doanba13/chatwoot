require 'rails_helper'

# Unit-level, mirroring procedure_service_spec.rb's own `.available?` block.
# The write path itself (`#perform`, headers, the account-scoped secret) is
# exercised end-to-end through ai_draft_instructions_controller_spec.rb,
# which stubs the HTTP boundary via WebMock one layer further out; this
# file is only `.available?`, which that controller spec has no reason to
# call directly (it only ever sees it through `AiDraftsController#capabilities`).
RSpec.describe Gotchu::InstructService do
  let(:gateway_url) { 'http://gateway.test:8137' }
  let(:gesture_secret) { 'a-gesture-secret' }
  let(:account_id) { 1 }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(gateway_url)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(gesture_secret)
  end

  # Coordinator ruling, Task 11 follow-up: `available?` must answer from
  # per-account resolution, the same way `ProcedureService.available?` now
  # does -- an account named only in GOTCHU_GATEWAY_SECRETS, with no
  # install-wide fallback, is genuinely available even though the old
  # single-variable check would have said otherwise.
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
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('a-shared-secret')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)

      expect(described_class.available?(account_id: account_id)).to be(true)
    end

    it 'is still false when the gateway URL or the gesture secret is missing, even with an account secret' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return("#{account_id}:only-for-this-account")
      allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return(nil)

      expect(described_class.available?(account_id: account_id)).to be(false)
    end
  end
end
