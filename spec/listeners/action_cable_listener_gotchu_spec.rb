require 'rails_helper'

# The widget receives messages over ActionCable as well as over its REST API,
# so the Gotchu stamp has to be stripped there too -- for the contact's tokens
# only; agents keep it.
describe ActionCableListener do
  let(:listener) { described_class.instance }
  let!(:account) { create(:account) }
  let!(:admin) { create(:user, account: account, role: :administrator) }
  let!(:inbox) { create(:inbox, account: account) }
  let!(:agent) { create(:user, account: account, role: :agent) }
  let!(:conversation) { create(:conversation, account: account, inbox: inbox, assignee: agent) }
  let(:stamp) { { 'cycleId' => 12, 'draftVersion' => 2 } }
  let!(:message) do
    create(:message, message_type: 'outgoing', account: account, inbox: inbox, conversation: conversation,
                     content_attributes: { 'gotchu' => stamp, 'submitted_email' => 'kunde@example.com' })
  end
  let(:broadcasts) { [] }

  before do
    create(:inbox_member, inbox: inbox, user: agent)
    inbox.reload
    Current.user = nil
    Current.account = nil
    allow(ActionCableBroadcastJob).to receive(:perform_later) { |tokens, name, data| broadcasts << [tokens, name, data] }
  end

  def payload_for(token)
    broadcasts.find { |tokens, _, _| tokens.include?(token) }&.last
  end

  def stamp_in(attrs)
    attrs.to_h.with_indifferent_access[:gotchu]
  end

  it 'sends a created message to the contact without the stamp and to agents with it' do
    listener.message_created(Events::Base.new(:'message.created', Time.zone.now, message: message))

    expect(stamp_in(payload_for(agent.pubsub_token)[:content_attributes])).to eq(stamp)
    expect(stamp_in(payload_for(admin.pubsub_token)[:content_attributes])).to eq(stamp)
    customer = payload_for(conversation.contact_inbox.pubsub_token)
    expect(stamp_in(customer[:content_attributes])).to be_nil
    expect(customer[:content_attributes].to_h.with_indifferent_access[:submitted_email]).to eq('kunde@example.com')
    expect(broadcasts.find { |tokens, _, _| tokens.include?(conversation.contact_inbox.pubsub_token) }.first)
      .to eq([conversation.contact_inbox.pubsub_token])
  end

  it 'strips the stamp from an updated message and from its previous changes' do
    changes = { 'content_attributes' => [{ 'gotchu' => stamp }, { 'gotchu' => stamp, 'in_reply_to' => 7 }] }
    listener.message_updated(Events::Base.new(:'message.updated', Time.zone.now, message: message, previous_changes: changes))

    customer = payload_for(conversation.contact_inbox.pubsub_token)
    expect(stamp_in(customer[:content_attributes])).to be_nil
    expect(customer[:previous_changes]['content_attributes']).to eq([{}, { 'in_reply_to' => 7 }])
    expect(payload_for(agent.pubsub_token)[:previous_changes]).to eq(changes)
  end

  it 'strips the stamp from the last message a conversation event carries to the contact' do
    listener.conversation_updated(Events::Base.new(:'conversation.updated', Time.zone.now, conversation: conversation))

    customer = payload_for(conversation.contact_inbox.pubsub_token)
    expect(customer[:messages].map { |m| stamp_in(m[:content_attributes]) }).to eq([nil])
    expect(stamp_in(payload_for(agent.pubsub_token)[:messages].first[:content_attributes])).to eq(stamp)
  end

  it 'keeps one broadcast for everyone when nothing carries a stamp' do
    plain = create(:message, message_type: 'outgoing', account: account, inbox: inbox, conversation: conversation)
    broadcasts.clear
    listener.message_created(Events::Base.new(:'message.created', Time.zone.now, message: plain))

    expect(broadcasts.size).to eq(1)
  end
end
