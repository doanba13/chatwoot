# The Agent overview read and the Stop for a holding auto send (spec
# 2026-10-04 §9.6, §11). Answers pass through unchanged; the page shows
# null numbers as a dash and computes none itself.
class Gotchu::AgentService
  NF = Gotchu::GatewayClient::NotFoundError
  CF = Gotchu::GatewayClient::ConflictError

  # A lost Stop, by the cause the gateway read back after its compare-and-set
  # (spec §9.6): the release got there first, or the cycle was no longer
  # holding for another reason (another person's Stop, a refused release).
  # A plain ConflictError is a 409 with no cause this build knows, which the
  # page words as sending.
  class SendingError < Gotchu::GatewayClient::ConflictError; end
  class StoppedError < Gotchu::GatewayClient::ConflictError; end

  NOT_HOLDING_CAUSES = { 'sending' => SendingError, 'stopped' => StoppedError }.freeze

  def self.available?(account_id:) = Gotchu::GatewayClient.available?(account_id: account_id)

  # `actor_id` and `account_id` are the SESSION's, never params.
  def initialize(actor_id:, account_id:)
    @actor = "chatwoot:#{actor_id}"
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # 404 is the dark gateway; the controller says so.
  def overview(days:)
    @client.request(verb: :get, path: '/api/agent/overview', query: { days: days }.compact, refusals: { NF => [404] })
  end

  # A compare-and-set at the gateway: exactly one of this Stop and the
  # release wins. A 409 means the release, or another person's Stop, got
  # there first, and its `cause` says which (`not_holding_error`).
  # `conversation_id` is the display id the controller authorised; the
  # gateway answers a cycle of another conversation as missing.
  def stop_auto(cycle_id:, conversation_id:)
    @client.request(verb: :post, path: "/api/cycles/#{cycle_id}/auto/stop",
                    body: { actor: @actor, conversationId: conversation_id },
                    refusals: { NF => [404] },
                    conflict_classifier: method(:not_holding_error))
  end

  private

  # Only the two causes this build words become their own class; the
  # gateway's text never travels. Every 409 on this route is a lost Stop, so
  # an unreadable body is still a ConflictError, never an outage.
  def not_holding_error(response)
    payload = JSON.parse(response.body.to_s)
    payload.is_a?(Hash) ? NOT_HOLDING_CAUSES.fetch(payload['cause'], CF) : CF
  rescue JSON::ParserError
    CF
  end
end
