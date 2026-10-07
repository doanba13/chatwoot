class Gotchu::InstructionCancelService
  # `working`: the cancel lost the compare-and-set and the job is still
  # running (amendment A). The dock keeps waiting on it.
  STATES = %w[cancelled working redrafted answered refused failed].freeze
  REQUEST_ID_FORMAT = Gotchu::DraftService::REQUEST_ID_FORMAT

  class InvalidError < StandardError; end

  def initialize(conversation:, account_id:, actor_id:, request_id:)
    raise InvalidError unless request_id.is_a?(String) && request_id.match?(REQUEST_ID_FORMAT)

    @conversation = conversation
    @request_id = request_id
    @actor = "chatwoot:#{actor_id}"
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  def perform
    payload = @client.request(verb: :post, path: "/api/instructions/#{@request_id}/cancel",
                              body: { conversationId: @conversation.display_id, actor: @actor },
                              refusals: { Gotchu::GatewayClient::NotFoundError => [404], InvalidError => [400] })
    status = payload['instruction']
    raise Gotchu::GatewayClient::UnavailableError, 'unknown cancel state' unless status.is_a?(Hash) && STATES.include?(status['state'])

    { 'instruction' => status.slice('state', 'version') }
  end
end
