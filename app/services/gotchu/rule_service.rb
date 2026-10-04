# Forwards the Agent rules screens to the gateway's /api/rules routes (spec
# 2026-10-04 §11). Request bodies are built in the gateway's camelCase here;
# answers pass through unchanged.
class Gotchu::RuleService
  # A refusal from validation carries the gateway's checks: fixed strings from
  # the spec's save-time checks, never merchant text, so they may reach the page.
  # `reason` is the gateway's machine code for the 400, narrowed to the codes a
  # page acts on (GatewayClient::REASONS_400); anything else reads 'invalid'.
  class InvalidError < Gotchu::GatewayClient::ValidationError
    attr_reader :checks, :reason

    def initialize(checks, reason = 'invalid')
      @checks = checks
      @reason = reason
      super('gateway refused the rule')
    end
  end

  def self.available?(account_id:) = Gotchu::GatewayClient.available?(account_id: account_id)

  # `actor_id` and `account_id` are the SESSION's, never params (the rule
  # ProcedureService documents).
  def initialize(actor_id:, account_id:)
    @actor = "chatwoot:#{actor_id}"
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # 404 on a list is the dark gateway (agent-screens plan A5), raised as
  # NotFoundError so the index can say so.
  def list(store: nil, inbox: nil, status: nil)
    @client.request(verb: :get, path: '/api/rules', query: { store: store, inbox: inbox, status: status }.compact,
                    refusals: { Gotchu::GatewayClient::NotFoundError => [404] })
  end

  def show(id:)
    @client.request(verb: :get, path: "/api/rules/#{id}", refusals: { Gotchu::GatewayClient::NotFoundError => [404] })
  end

  # Created `testing` by the gateway; nothing here can ask for another status.
  def create(rule:) = write(:post, '/api/rules', rule)

  # `expected_version` is a precondition only: a mismatch is a 409.
  def revise(id:, rule:, expected_version:)
    write(:post, "/api/rules/#{id}/revisions", rule.merge(expectedVersion: expected_version))
  end

  def set_status(id:, status:, expected_version:)
    write(:post, "/api/rules/#{id}/status", { status: status, expectedVersion: expected_version })
  end

  # Runs the save-time checks and the overlap function without writing.
  def check(rule:)
    @client.request(verb: :post, path: '/api/rules/check', body: rule,
                    checks_error: InvalidError)
  end

  # Spec §11: `{ conditions, scope, days ≤ 30, ruleId?, actor }`. Only the
  # conditions and scope of the rule travel; its text and sending do not
  # change what it would have matched.
  def replay(rule:, days:, rule_id: nil)
    @client.request(verb: :post, path: '/api/rules/replay',
                    body: { conditions: rule[:conditions], scope: rule[:scope], days: days, ruleId: rule_id, actor: @actor }.compact,
                    timeout: Gotchu::ProcedureService::REPLAY_TIMEOUT_SECONDS,
                    checks_error: InvalidError)
  end

  private

  def write(verb, path, body)
    @client.request(verb: verb, path: path, body: body.merge(actor: @actor),
                    checks_error: InvalidError,
                    refusals: { Gotchu::GatewayClient::NotFoundError => [404], Gotchu::GatewayClient::ConflictError => [409] })
  end
end
