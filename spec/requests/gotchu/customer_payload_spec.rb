require 'rails_helper'

# content_attributes.gotchu ({cycleId, draftVersion}) marks an agent reply as a
# sent Gotchu draft. The agent dashboard and the webhook need it; a customer
# must never see it.
RSpec.describe 'Gotchu stamp on customer-facing message payloads', type: :request do
  let(:stamp) { { 'cycleId' => 12, 'draftVersion' => 2 } }

  def expect_unstamped(attrs)
    expect(attrs).not_to have_key('gotchu')
    expect(attrs['submitted_email']).to eq('kunde@example.com')
  end

  def stamped_reply(conversation)
    create(:message, account: conversation.account, inbox: conversation.inbox, conversation: conversation,
                     message_type: :outgoing, content_attributes: { 'gotchu' => stamp, 'submitted_email' => 'kunde@example.com' })
  end

  describe 'the web widget' do
    let(:account) { create(:account) }
    let(:web_widget) { create(:channel_widget, account: account) }
    let(:contact) { create(:contact, account: account, email: nil) }
    let(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: web_widget.inbox) }
    let(:conversation) { create(:conversation, contact: contact, account: account, inbox: web_widget.inbox, contact_inbox: contact_inbox) }
    let(:token) { Widget::TokenService.new(payload: { source_id: contact_inbox.source_id, inbox_id: web_widget.inbox.id }).generate_token }

    it 'lists messages without the stamp, keeping every other attribute' do
      message = stamped_reply(conversation)
      get api_v1_widget_messages_url, params: { website_token: web_widget.website_token },
                                      headers: { 'X-Auth-Token' => token }, as: :json
      expect(response).to have_http_status(:success)
      listed = response.parsed_body['payload'].find { |m| m['id'] == message.id }
      expect_unstamped(listed['content_attributes'])
    end

    it 'renders a created message and a new conversation\'s messages without the stamp' do
      message = stamped_reply(conversation)
      created = JSON.parse(ApplicationController.render(template: 'api/v1/widget/messages/create', formats: [:json],
                                                        assigns: { message: message }))
      partial = JSON.parse(ApplicationController.render(partial: 'api/v1/models/widget_message', formats: [:json],
                                                        locals: { resource: message }))
      expect_unstamped(created['content_attributes'])
      expect_unstamped(partial['content_attributes'])
    end
  end

  describe 'the public client API' do
    let!(:api_channel) { create(:channel_api) }
    let!(:contact) { create(:contact, email: 'customer@example.com') }
    let!(:contact_inbox) { create(:contact_inbox, contact: contact, inbox: api_channel.inbox) }
    let!(:conversation) { create(:conversation, contact: contact, contact_inbox: contact_inbox) }

    it 'lists messages without the stamp' do
      message = stamped_reply(conversation)
      get "/public/api/v1/inboxes/#{api_channel.identifier}/contacts/#{contact_inbox.source_id}/conversations/#{conversation.display_id}/messages"
      expect(response).to have_http_status(:success)
      listed = response.parsed_body.find { |m| m['id'] == message.id }
      expect_unstamped(listed['content_attributes'])
    end
  end

  describe 'the agent dashboard' do
    let(:account) { create(:account) }
    let(:agent) { create(:user, account: account, role: :administrator) }
    let(:conversation) { create(:conversation, account: account) }

    it 'still carries the stamp' do
      message = stamped_reply(conversation)
      get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages",
          headers: agent.create_new_auth_token, as: :json
      listed = response.parsed_body['payload'].find { |m| m['id'] == message.id }
      expect(listed['content_attributes']['gotchu']).to eq(stamp)
    end
  end
end
