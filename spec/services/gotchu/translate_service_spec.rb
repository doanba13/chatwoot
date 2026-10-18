require 'rails_helper'

RSpec.describe Gotchu::TranslateService do
  let(:account) { create(:account) }
  let(:service) { described_class.new(account_id: account.id) }
  let(:url) { 'http://gateway.test:8137/api/translate' }
  let(:inbox) { create(:inbox, account: account) }
  let(:conversation) { create(:conversation, inbox: inbox, account: account) }
  let(:message) { create(:message, conversation: conversation, account: account, inbox: inbox, content: 'Hallo Welt') }

  before do
    allow(ENV).to receive(:fetch).and_call_original
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return('http://gateway.test:8137')
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('a-shared-secret')
    allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
    allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return('a-gesture-secret')
  end

  def stub_gateway(status: 200, body: { text: 'Hello World', partial: false, skipped: false })
    stub_request(:post, url).with(query: { secret: 'a-shared-secret' })
                            .to_return(status: status, body: body.to_json)
  end

  it 'targets exactly en vi de fr' do
    expect(described_class::TARGETS).to eq(%w[en vi de fr])
  end

  describe '#message' do
    it 'sends the stored content with the gesture secret and account header' do
      stub = stub_gateway.with(
        body: { kind: 'message', conversationId: conversation.display_id, messageId: message.id,
                text: 'Hallo Welt', target: 'en' }.to_json,
        headers: { 'X-Gesture-Secret' => 'a-gesture-secret', 'X-Chatwoot-Account-Id' => account.id.to_s }
      )
      expect(service.message(message: message, target: 'en')).to eq(text: 'Hello World', partial: false, skipped: false)
      expect(stub).to have_been_requested
    end

    it 'returns nil for 429, 502 and transport failures' do
      [429, 502, 400, 404, 409].each do |status|
        stub_gateway(status: status, body: { error: 'x' })
        expect(service.message(message: message, target: 'en')).to be_nil
      end
      stub_request(:post, url).with(query: { secret: 'a-shared-secret' }).to_timeout
      expect(service.message(message: message, target: 'en')).to be_nil
    end

    it 'returns nil when the gateway is not configured' do
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return(nil)
      expect(service.message(message: message, target: 'en')).to be_nil
    end

    context 'with an email message' do
      let(:inbox) { create(:inbox, account: account, channel: create(:channel_email, account: account)) }

      def email_message(attrs)
        create(:message, conversation: conversation, account: account, inbox: inbox, content: 'x',
                         content_attributes: { email: attrs })
      end

      it 'sends an HTML-only email as text with blank lines between blocks' do
        stub = stub_gateway.with { |req| JSON.parse(req.body)['text'] == "Hallo\n\nWelt" }
        service.message(message: email_message(html_content: { full: '<p>Hallo</p><p>Welt</p>' }), target: 'en')
        expect(stub).to have_been_requested
      end

      it 'prefers the text part over HTML when both exist' do
        stub = stub_gateway.with { |req| JSON.parse(req.body)['text'] == 'plain part' }
        service.message(message: email_message(text_content: { full: 'plain part' },
                                               html_content: { full: '<p>html part</p>' }), target: 'en')
        expect(stub).to have_been_requested
      end
    end
  end

  describe '#draft' do
    it 'posts the draft kind' do
      stub = stub_gateway.with(body: { kind: 'draft', conversationId: 7, cycleId: 5, version: 3, target: 'fr' }.to_json)
      expect(service.draft(conversation_id: 7, cycle_id: 5, version: 3, target: 'fr')).to include(text: 'Hello World')
      expect(stub).to have_been_requested
    end

    it 'raises ConflictError on 409' do
      stub_gateway(status: 409, body: { error: 'stale', latest: 4 })
      expect { service.draft(conversation_id: 7, cycle_id: 5, version: 3, target: 'fr') }
        .to raise_error(Gotchu::GatewayClient::ConflictError)
    end

    it 'returns nil on 429' do
      stub_gateway(status: 429, body: { error: 'limited' })
      expect(service.draft(conversation_id: 7, cycle_id: 5, version: 3, target: 'fr')).to be_nil
    end
  end
end
