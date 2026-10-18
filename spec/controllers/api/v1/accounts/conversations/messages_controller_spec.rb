require 'rails_helper'

RSpec.describe 'Conversation Messages API', type: :request do
  let!(:account) { create(:account) }

  describe 'POST /api/v1/accounts/{account.id}/conversations/<id>/messages' do
    let!(:inbox) { create(:inbox, account: account) }
    let!(:conversation) { create(:conversation, inbox: inbox, account: account) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id)

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user with access to conversation' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'creates a new outgoing message' do
        params = { content: 'test-message', private: true }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(conversation.messages.count).to eq(1)
        expect(conversation.messages.first.content).to eq(params[:content])
      end

      it 'does not create the message' do
        params = { content: "#{'h' * 150 * 1000}a", private: true }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unprocessable_entity)

        json_response = response.parsed_body

        expect(json_response['error']).to eq('Validation failed: Content is too long (maximum is 150000 characters)')
      end

      it 'returns a customer-safe error when the database query is canceled' do
        message_builder = instance_double(Messages::MessageBuilder)
        allow(Messages::MessageBuilder).to receive(:new).and_return(message_builder)
        allow(message_builder).to receive(:perform)
          .and_raise(ActiveRecord::QueryCanceled, 'PG::QueryCanceled: ERROR: canceling statement due to statement timeout')

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: { content: 'test-message', private: true },
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to eq(I18n.t('errors.database.query_canceled'))
        expect(response.parsed_body['error']).not_to include('PG::QueryCanceled')
      end

      it 'creates an outgoing text message with a specific bot sender' do
        agent_bot = create(:agent_bot)
        time_stamp = Time.now.utc.to_s
        params = { content: 'test-message', external_created_at: time_stamp, sender_type: 'AgentBot', sender_id: agent_bot.id }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        response_data = response.parsed_body
        expect(response_data['content_attributes']['external_created_at']).to eq time_stamp
        expect(conversation.messages.count).to eq(1)
        expect(conversation.messages.last.sender_id).to eq(agent_bot.id)
        expect(conversation.messages.last.content_type).to eq('text')
      end

      it 'creates a new outgoing message with attachment' do
        file = fixture_file_upload(Rails.root.join('spec/assets/avatar.png'), 'image/png')
        params = { content: 'test-message', attachments: [file] }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: agent.create_new_auth_token

        expect(response).to have_http_status(:success)
        expect(conversation.messages.last.attachments.first.file.present?).to be(true)
        expect(conversation.messages.last.attachments.first.file_type).to eq('image')
      end

      context 'when api inbox' do
        let(:api_channel) { create(:channel_api, account: account) }
        let(:api_inbox) { create(:inbox, channel: api_channel, account: account) }
        let(:conversation) { create(:conversation, inbox: api_inbox, account: account) }

        it 'reopens the conversation with new incoming message' do
          create(:message, conversation: conversation, account: account)
          conversation.resolved!

          params = { content: 'test-message', private: false, message_type: 'incoming' }

          post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
               params: params,
               headers: agent.create_new_auth_token,
               as: :json

          expect(response).to have_http_status(:success)
          expect(conversation.reload.status).to eq('open')
          expect(Conversations::ActivityMessageJob)
            .to(have_been_enqueued.at_least(:once)
              .with(conversation, { account_id: conversation.account_id, inbox_id: conversation.inbox_id, message_type: :activity,
                                    content: 'System reopened the conversation due to a new incoming message.',
                                    content_attributes: {
                                      activity: {
                                        type: 'conversation_status_changed',
                                        status: 'open'
                                      }
                                    } }))
        end
      end
    end

    context 'when it is an authenticated agent bot' do
      let!(:agent_bot) { create(:agent_bot) }

      it 'creates a new outgoing message' do
        create(:agent_bot_inbox, inbox: inbox, agent_bot: agent_bot)
        params = { content: 'test-message' }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: { api_access_token: agent_bot.access_token.token },
             as: :json

        expect(response).to have_http_status(:success)
        expect(conversation.messages.count).to eq(1)
        expect(conversation.messages.first.content).to eq(params[:content])
      end

      it 'creates a new outgoing input select message' do
        create(:agent_bot_inbox, inbox: inbox, agent_bot: agent_bot)
        select_item1 = build(:bot_message_select)
        select_item2 = build(:bot_message_select)
        params = { content_type: 'input_select', content_attributes: { items: [select_item1, select_item2] } }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: { api_access_token: agent_bot.access_token.token },
             as: :json

        expect(response).to have_http_status(:success)
        expect(conversation.messages.count).to eq(1)
        expect(conversation.messages.first.content_type).to eq(params[:content_type])
        expect(conversation.messages.first.content).to be_nil
      end

      it 'creates a new outgoing cards message' do
        create(:agent_bot_inbox, inbox: inbox, agent_bot: agent_bot)
        card = build(:bot_message_card)
        params = { content_type: 'cards', content_attributes: { items: [card] } }

        post api_v1_account_conversation_messages_url(account_id: account.id, conversation_id: conversation.display_id),
             params: params,
             headers: { api_access_token: agent_bot.access_token.token },
             as: :json

        expect(response).to have_http_status(:success)
        expect(conversation.messages.count).to eq(1)
        expect(conversation.messages.first.content_type).to eq(params[:content_type])
      end
    end
  end

  describe 'GET /api/v1/accounts/{account.id}/conversations/:id/messages' do
    let(:conversation) { create(:conversation, account: account) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages"

        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user with access to conversation' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'shows the conversation' do
        get "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages",
            headers: agent.create_new_auth_token,
            as: :json

        expect(response).to have_http_status(:success)
        expect(response).to conform_schema(200)
        expect(JSON.parse(response.body, symbolize_names: true)[:meta][:contact][:id]).to eq(conversation.contact_id)
      end
    end
  end

  describe 'DELETE /api/v1/accounts/{account.id}/conversations/:conversation_id/messages/:id' do
    let(:message) { create(:message, account: account, content_attributes: { bcc_emails: ['hello@chatwoot.com'] }) }
    let(:conversation) { message.conversation }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        delete "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages/#{message.id}"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user with access to conversation' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'deletes the message' do
        delete "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages/#{message.id}",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:success)
        expect(message.reload.content).to eq 'This message was deleted'
        expect(message.reload.deleted).to be true
        expect(message.reload.content_attributes['bcc_emails']).to be_nil
      end

      it 'deletes interactive messages' do
        interactive_message = create(
          :message, message_type: :outgoing, content: 'test', content_type: 'input_select',
                    content_attributes: { 'items' => [{ 'title' => 'test', 'value' => 'test' }] },
                    conversation: conversation
        )

        delete "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages/#{interactive_message.id}",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:success)
        expect(interactive_message.reload.deleted).to be true
      end
    end

    context 'when the message id is invalid' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: conversation.inbox, user: agent)
      end

      it 'returns not found error' do
        delete "/api/v1/accounts/#{account.id}/conversations/#{conversation.display_id}/messages/99999",
               headers: agent.create_new_auth_token,
               as: :json

        expect(response).to have_http_status(:not_found)
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/conversations/:conversation_id/messages/:id/retry' do
    let(:message) { create(:message, account: account, status: :failed, content_attributes: { external_error: 'error' }) }

    context 'when it is an unauthenticated user' do
      it 'returns unauthorized' do
        post "/api/v1/accounts/#{account.id}/conversations/#{message.conversation.display_id}/messages/#{message.id}/retry"
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when it is an authenticated user with access to conversation' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: message.conversation.inbox, user: agent)
      end

      it 'retries the message' do
        post "/api/v1/accounts/#{account.id}/conversations/#{message.conversation.display_id}/messages/#{message.id}/retry",
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:success)
        expect(message.reload.status).to eq('sent')
        expect(message.reload.content_attributes['external_error']).to be_nil
      end
    end

    context 'when the message id is invalid' do
      let(:agent) { create(:user, account: account, role: :agent) }

      before do
        create(:inbox_member, inbox: message.conversation.inbox, user: agent)
      end

      it 'returns not found error' do
        post "/api/v1/accounts/#{account.id}/conversations/#{message.conversation.display_id}/messages/99999/retry",
             headers: agent.create_new_auth_token,
             as: :json

        expect(response).to have_http_status(:unprocessable_entity)
      end
    end
  end

  describe 'PATCH /api/v1/accounts/{account.id}/conversations/:conversation_id/messages/:id' do
    let(:api_channel) { create(:channel_api, account: account) }
    let(:api_inbox) { create(:inbox, channel: api_channel, account: account) }
    let(:agent) { create(:user, account: account, role: :agent) }
    let!(:conversation) { create(:conversation, inbox: api_inbox, account: account) }
    let!(:message) { create(:message, conversation: conversation, account: account, status: :sent) }

    context 'when unauthenticated' do
      it 'returns unauthorized' do
        patch api_v1_account_conversation_message_url(account_id: account.id, conversation_id: conversation.display_id, id: message.id)
        expect(response).to have_http_status(:unauthorized)
      end
    end

    context 'when authenticated agent' do
      context 'when agent has non-API inbox' do
        let(:inbox) { create(:inbox, account: account) }
        let(:agent) { create(:user, account: account, role: :agent) }
        let!(:conversation) { create(:conversation, inbox: inbox, account: account) }

        before { create(:inbox_member, inbox: inbox, user: agent) }

        it 'returns forbidden' do
          patch api_v1_account_conversation_message_url(
            account_id: account.id,
            conversation_id: conversation.display_id,
            id: message.id
          ), params: { status: 'failed', external_error: 'err' }, headers: agent.create_new_auth_token, as: :json
          expect(response).to have_http_status(:forbidden)
        end
      end

      context 'when agent has API inbox' do
        before { create(:inbox_member, inbox: api_inbox, user: agent) }

        it 'uses StatusUpdateService to perform status update' do
          service = instance_double(Messages::StatusUpdateService)
          expect(Messages::StatusUpdateService).to receive(:new)
            .with(message, 'failed', 'err123')
            .and_return(service)
          expect(service).to receive(:perform)
          patch api_v1_account_conversation_message_url(
            account_id: account.id,
            conversation_id: conversation.display_id,
            id: message.id
          ), params: { status: 'failed', external_error: 'err123' }, headers: agent.create_new_auth_token, as: :json
        end

        it 'updates status to failed with external_error' do
          patch api_v1_account_conversation_message_url(
            account_id: account.id,
            conversation_id: conversation.display_id,
            id: message.id
          ), params: { status: 'failed', external_error: 'err123' }, headers: agent.create_new_auth_token, as: :json

          expect(response).to have_http_status(:success)
          expect(message.reload.status).to eq('failed')
          expect(message.reload.external_error).to eq('err123')
        end
      end
    end
  end

  describe 'POST /api/v1/accounts/{account.id}/conversations/<id>/messages/{id}/translate' do
    let(:agent) { create(:user, account: account, role: :agent) }
    let(:inbox) { create(:inbox, account: account) }
    let(:conversation) { create(:conversation, inbox: inbox, account: account) }
    let(:message) { create(:message, conversation: conversation, account: account, inbox: inbox, content: 'Hallo Welt') }
    let(:gateway_url) { 'http://gateway.test:8137/api/translate' }
    let(:gateway_reply) { { text: 'xin chào', partial: false, skipped: false } }

    before do
      create(:inbox_member, inbox: inbox, user: agent)
      allow(ENV).to receive(:fetch).and_call_original
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_URL', nil).and_return('http://gateway.test:8137')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRET', nil).and_return('a-shared-secret')
      allow(ENV).to receive(:fetch).with('GOTCHU_GATEWAY_SECRETS', nil).and_return(nil)
      allow(ENV).to receive(:fetch).with('GOTCHU_GESTURE_SECRET', nil).and_return('a-gesture-secret')
    end

    def stub_gateway(status: 200, body: gateway_reply)
      stub_request(:post, gateway_url).with(query: { secret: 'a-shared-secret' })
                                      .to_return(status: status, body: body.to_json)
    end

    def translate(target, extra = {})
      post translate_api_v1_account_conversation_message_url(account_id: account.id, conversation_id: conversation.display_id, id: message.id),
           params: { target_language: target }.merge(extra), headers: agent.create_new_auth_token, as: :json
    end

    it 'refuses target_language outside en vi de fr' do
      stub = stub_gateway
      translate('es')
      expect(response).to have_http_status(:unprocessable_entity)
      expect(stub).not_to have_been_requested
    end

    it 'stores the translation under the target language and returns it' do
      stub_gateway
      translate('vi')
      expect(response).to have_http_status(:success)
      expect(response.parsed_body['content']).to eq('xin chào')
      expect(message.reload.translations['vi']).to eq('xin chào')
    end

    it 'merges with translations already stored for other languages' do
      message.update!(translations: { 'de' => 'Hallo' })
      stub_gateway
      translate('vi')
      expect(message.reload.translations).to eq('de' => 'Hallo', 'vi' => 'xin chào')
    end

    it 'does not call the gateway when the language is already stored' do
      message.update!(translations: { 'vi' => 'da co' })
      stub = stub_gateway
      translate('vi')
      expect(response).to have_http_status(:ok)
      expect(stub).not_to have_been_requested
    end

    it 'stores nothing when the gateway refuses' do
      [429, 502].each do |status|
        stub_gateway(status: status, body: { error: 'x' })
        translate('vi')
        expect(response).to have_http_status(:unprocessable_entity)
        expect(response.parsed_body['error']).to be_present
        expect(message.reload.translations).to be_blank
      end
    end

    it 'records partial' do
      stub_gateway(body: { text: 'Hallo', partial: true, skipped: false })
      translate('de')
      expect(message.reload.translation_partial).to include('de')
    end

    it 'stores nothing and returns the original when skipped' do
      stub_gateway(body: { text: '', partial: false, skipped: true })
      translate('de')
      expect(response.parsed_body['content']).to eq('Hallo Welt')
      expect(message.reload.translations).to be_blank
    end

    it 'ignores a text param and sends the stored content' do
      stub = stub_gateway.with { |req| JSON.parse(req.body)['text'] == 'Hallo Welt' }
      translate('vi', text: 'attacker text', content: 'attacker content')
      expect(stub).to have_been_requested
    end

    it 'does not consult the google_translate hook' do
      create(:integrations_hook, account: account, app_id: 'google_translate', settings: { project_id: 'p', credentials: {} })
      stub_gateway
      expect(Integrations::GoogleTranslate::ProcessorService).not_to receive(:new)
      translate('vi')
      expect(response).to have_http_status(:success)
    end

    context 'with an email message' do
      let(:inbox) { create(:inbox, account: account, channel: create(:channel_email, account: account)) }

      it 'stores an HTML-only email translation as escaped paragraphs' do
        message.update!(content_attributes: { email: { html_content: { full: '<p>Hallo</p><p>Welt</p>' } } })
        stub = stub_gateway(body: { text: "Hello\n\nWorld", partial: false, skipped: false }).with do |req|
          JSON.parse(req.body)['text'] == "Hallo\n\nWelt"
        end
        translate('en')
        expect(stub).to have_been_requested
        expect(message.reload.translations['en']).to eq("<p>Hello</p>\n\n<p>World</p>")
      end

      it 'prefers the email text part over HTML when both exist' do
        message.update!(content_attributes: { email: { text_content: { full: 'plain' }, html_content: { full: '<p>html</p>' } } })
        stub = stub_gateway.with { |req| JSON.parse(req.body)['text'] == 'plain' }
        translate('en')
        expect(stub).to have_been_requested
      end

      it 'stores gateway markup escaped' do
        evil = '<img src=x onerror=alert(1)><script>alert(2)</script>'
        stub_gateway(body: { text: evil, partial: false, skipped: false })
        translate('en')
        stored = message.reload.translations['en']
        expect(stored).not_to include('<img')
        expect(stored).not_to include('<script')
        expect(stored).to include('&lt;img src=x onerror=alert(1)&gt;')
      end
    end

    it 'stores gateway markup as plain text for a non-email message' do
      stub_gateway(body: { text: '<b>x</b>', partial: false, skipped: false })
      translate('en')
      expect(message.reload.translations['en']).to eq('<b>x</b>')
    end
  end
end
