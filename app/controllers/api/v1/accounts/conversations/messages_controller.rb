class Api::V1::Accounts::Conversations::MessagesController < Api::V1::Accounts::Conversations::BaseController
  TRANSLATE_FAILED = 'Could not translate this message'.freeze

  before_action :ensure_api_inbox, only: :update

  def index
    @messages = message_finder.perform
  end

  def create
    user = Current.user || @resource
    mb = Messages::MessageBuilder.new(user, @conversation, params)
    @message = mb.perform
  rescue StandardError => e
    render_could_not_create_error(e.message)
  end

  def update
    Messages::StatusUpdateService.new(message, permitted_params[:status], permitted_params[:external_error]).perform
    @message = message
  end

  def destroy
    ActiveRecord::Base.transaction do
      message.update!(content: I18n.t('conversations.messages.deleted'), content_type: :text, content_attributes: { deleted: true })
      message.attachments.destroy_all
    end
  end

  def retry
    return if message.blank?

    ::SendReplyJob.perform_later(message.id) if claim_message_retry
  rescue StandardError => e
    render_could_not_create_error(e.message)
  end

  def translate
    target = permitted_params[:target_language]
    return render_could_not_create_error(TRANSLATE_FAILED) unless Gotchu::TranslateService::TARGETS.include?(target)
    return head :ok if already_translated_content_available?

    result = Gotchu::TranslateService.new(account_id: Current.account.id).message(message: message, target: target)
    return render_could_not_create_error(TRANSLATE_FAILED) if result.nil?
    return render json: { content: message.content } if result[:skipped]

    store_translation(target, result)
    render json: { content: stored_content(result[:text]) }
  end

  private

  # Email bubbles render the stored translation as HTML, so it is escaped
  # paragraphs there; every other bubble interpolates it as plain text.
  def stored_content(text)
    return text unless message.inbox.email?

    text.split(/\n{2,}/).compact_blank.map do |paragraph|
      "<p>#{ERB::Util.html_escape(paragraph.strip).gsub("\n", '<br />')}</p>"
    end.join("\n\n")
  end

  def store_translation(target, result)
    partial = Array(message.translation_partial) - [target]
    partial << target if result[:partial]
    message.update!(
      translations: (message.translations.presence || {}).merge(target => stored_content(result[:text])),
      translation_partial: partial
    )
  end

  def message
    @message ||= @conversation.messages.find(permitted_params[:id])
  end

  def message_finder
    @message_finder ||= MessageFinder.new(@conversation, params)
  end

  def claim_message_retry
    message.with_lock do
      next false unless message.failed?

      Messages::StatusUpdateService.new(message, 'sent').perform
      previous_source_id = message.source_id
      retry_attributes = { content_attributes: {} }
      retry_attributes[:source_id] = nil unless @conversation.inbox.api? || @conversation.inbox.web_widget?
      message.update!(retry_attributes)
      if retry_attributes.key?(:source_id) && previous_source_id.present?
        Rails.logger.info "Cleared older source ID #{previous_source_id} for message #{message.id}"
      end
      true
    end
  end

  def permitted_params
    params.permit(:id, :target_language, :status, :external_error)
  end

  def already_translated_content_available?
    message.translations.present? && message.translations[permitted_params[:target_language]].present?
  end

  # API inbox check
  def ensure_api_inbox
    # Only API inboxes can update messages
    render json: { error: 'Message status update is only allowed for API inboxes' }, status: :forbidden unless @conversation.inbox.api?
  end
end

Api::V1::Accounts::Conversations::MessagesController.prepend_mod_with('Api::V1::Accounts::Conversations::MessagesController')
