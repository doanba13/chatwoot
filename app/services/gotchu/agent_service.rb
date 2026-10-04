# The Agent overview read and the Stop for a holding auto send (spec
# 2026-10-04 §9.6, §11). Answers pass through unchanged; the page shows
# null numbers as a dash and computes none itself.
class Gotchu::AgentService
  NF = Gotchu::GatewayClient::NotFoundError
  CF = Gotchu::GatewayClient::ConflictError

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
  # there first, and nothing here can say which.
  def stop_auto(cycle_id:)
    @client.request(verb: :post, path: "/api/cycles/#{cycle_id}/auto/stop", body: { actor: @actor },
                    refusals: { NF => [404], CF => [409] })
  end
end
