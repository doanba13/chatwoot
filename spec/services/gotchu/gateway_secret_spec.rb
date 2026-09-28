require 'rails_helper'

# Every gateway-calling class (ProcedureService, DraftService,
# InstructService) resolves its secret through this one module. Tested here
# once rather than duplicated per caller; each caller's own spec only needs
# to prove it is actually wired to this resolver (own secret, own header,
# 503/no-request when nothing resolves) -- not re-prove the parsing rules.
RSpec.describe Gotchu::GatewaySecret do
  describe '.parse' do
    it 'maps each entry by its integer account id' do
      expect(described_class.parse('1:one,2:two')).to eq(1 => 'one', 2 => 'two')
    end

    it 'treats a blank or nil input as an empty map' do
      expect(described_class.parse(nil)).to eq({})
      expect(described_class.parse('')).to eq({})
    end

    it 'ignores a malformed entry and warns naming its index, never its text' do
      expect(Rails.logger).to receive(:warn).with('GOTCHU_GATEWAY_SECRETS entry 0 is malformed and was ignored')
      expect(Rails.logger).to receive(:warn).with('GOTCHU_GATEWAY_SECRETS entry 2 is malformed and was ignored')

      result = described_class.parse('not-a-number:s3cr3t,1:one,2')

      expect(result).to eq(1 => 'one')
    end
  end

  describe '.for_account' do
    before do
      allow(ENV).to receive(:fetch).and_call_original
    end

    it "returns the account's own secret when GOTCHU_GATEWAY_SECRETS names it" do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('1:only-for-account-1')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('shared-secret')

      expect(described_class.for_account(1)).to eq('only-for-account-1')
    end

    # Fix wave E. Once the map exists the install is multi-account, and the
    # single variable is the LEGACY account's credential: handing it to an
    # account the map forgot would let that account act as the legacy one.
    it 'gives no secret to an account a set map does not list, even with the single variable set' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('999:someone-elses-secret')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('shared-secret')

      expect(described_class.for_account(1)).to be_nil
    end

    it 'falls back to the single variable when GOTCHU_GATEWAY_SECRETS is set but blank' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('  ')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('shared-secret')

      expect(described_class.for_account(1)).to eq('shared-secret')
    end

    it 'falls back to the single variable when GOTCHU_GATEWAY_SECRETS is entirely unset' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('shared-secret')

      expect(described_class.for_account(1)).to eq('shared-secret')
    end

    it 'returns nil when neither the map nor the single variable name the account' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return('999:someone-elses-secret')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return(nil)

      expect(described_class.for_account(1)).to be_nil
    end
  end
end
