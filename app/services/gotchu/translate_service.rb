# Message translation through the Gotchu gateway, in place of the per-account
# Google key. The text sent is always read from the account-scoped Message row
# the caller found, never from a request param.
#
# Never logs or raises text: a failure is nil (message) or an error class
# (draft conflict), and nothing here writes a log line carrying either language.
class Gotchu::TranslateService
  # One constant per repo; the gateway refuses anything else too.
  TARGETS = %w[en vi de fr].freeze

  # Long mail is translated in chunks on the gateway side.
  TIMEOUT_SECONDS = 20

  BLOCK_TAGS = %w[p div h1 h2 h3 h4 h5 h6 li tr blockquote ul ol table pre].freeze

  def initialize(account_id:)
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # { text:, partial:, skipped: }, or nil when it could not be translated.
  def message(message:, target:)
    text = source_text(message)
    return nil if text.blank?

    post({ kind: 'message', conversationId: message.conversation.display_id,
           messageId: message.id, text: text, target: target })
  end

  # Same answer shape. A draft that is no longer the latest version raises
  # GatewayClient::ConflictError so the caller can say "reload".
  def draft(conversation_id:, version:, target:)
    post(
      { kind: 'draft', conversationId: conversation_id, version: version, target: target },
      refusals: { Gotchu::GatewayClient::ConflictError => [409] }
    )
  end

  private

  def post(body, refusals: {})
    answer = @client.request(verb: :post, path: '/api/translate', body: body, timeout: TIMEOUT_SECONDS, refusals: refusals)
    { text: answer['text'].to_s, partial: answer['partial'] == true, skipped: answer['skipped'] == true }
  rescue Gotchu::GatewayClient::UnavailableError, Gotchu::GatewayClient::ConfigurationError
    nil
  end

  def source_text(message)
    return message.content unless message.inbox&.email?

    email = message.content_attributes['email'] || {}
    text = email.dig('text_content', 'full')
    return text if text.present?

    html = email.dig('html_content', 'full')
    html.present? ? html_to_text(html) : message.content
  end

  # Block elements become blank-line separated paragraphs, <br> a newline.
  def html_to_text(html)
    doc = Nokogiri::HTML.fragment(html)
    doc.css('script, style').each(&:remove)
    doc.css('br').each { |node| node.replace("\n") }
    doc.css(BLOCK_TAGS.join(',')).each { |node| node.add_next_sibling("\n\n") }
    doc.text.gsub(/[ \t]+\n/, "\n").gsub(/\n{3,}/, "\n\n").strip
  end
end
