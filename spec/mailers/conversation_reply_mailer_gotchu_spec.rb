require 'rails_helper'

describe ConversationReplyMailer do
  let(:account) { create(:account) }
  let(:agent) { create(:user, account: account, name: 'Jane Agent') }
  let(:channel) do
    create(:channel_email, smtp_enabled: true, smtp_address: 'smtp.gmail.com', smtp_port: 587, smtp_login: 'desk@gmail.com',
                           smtp_password: 'password', smtp_domain: 'smtp.gmail.com', email: 'desk@gmail.com', account: account)
  end
  let(:conversation) { create(:conversation, assignee: agent, inbox: channel.inbox, account: account).reload }
  let(:message) do
    create(:message, conversation: conversation, account: account, sender: agent, message_type: 'outgoing', content: 'Hallo, **danke**.')
  end

  before { channel.inbox.update!(sender_name_type: :friendly) }

  it "answers a store's conversation in the store's name, not the agent's" do
    conversation.update!(custom_attributes: { 'store_key' => 'persoliebe' })

    expect(described_class.email_reply(message)['from'].value).to eq 'Persoliebe <desk@gmail.com>'
  end

  it 'keeps the upstream sender name when no store is attributed' do
    from = described_class.email_reply(message)['from'].value

    expect(from).to include(' from ')
    expect(from).not_to start_with('Persoliebe')
  end

  it 'puts the Message-ID on our own domain when one is set' do
    with_modified_env GOTCHU_MESSAGE_ID_DOMAIN: 'support.example.com' do
      expect(described_class.email_reply(message).message_id).to end_with('@support.example.com')
    end
  end

  it 'keeps the upstream Message-ID domain when none is set' do
    expect(described_class.email_reply(message).message_id).not_to end_with('@support.example.com')
  end
end
