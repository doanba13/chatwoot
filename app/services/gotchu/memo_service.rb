# Forwards the Agent memo screens, the composer's Memo tab and the memo
# proposals to the gateway (spec 2026-10-04 §6, §11). Request bodies are built
# in the gateway's camelCase by the controller; answers pass through.
class Gotchu::MemoService
  InvalidError = Gotchu::RuleService::InvalidError
  NF = Gotchu::GatewayClient::NotFoundError
  CF = Gotchu::GatewayClient::ConflictError

  def self.available?(account_id:) = Gotchu::GatewayClient.available?(account_id: account_id)

  # `actor_id` and `account_id` are the SESSION's, never params.
  def initialize(actor_id:, account_id:)
    @actor = "chatwoot:#{actor_id}"
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # 404 on a list is the dark gateway; the controller says so.
  def list(store: nil, inbox: nil, include_expired: false)
    @client.request(verb: :get, path: '/api/memos',
                    query: { store: store, inbox: inbox, include: include_expired ? 'expired' : nil }.compact,
                    refusals: { NF => [404] })
  end

  def create(memo:) = write(:post, '/api/memos', memo)

  # An edit supersedes: the answer is the NEW memo (spec §6.2).
  def update(id:, memo:) = write(:put, "/api/memos/#{id}", memo)

  # A soft revoke. The gateway answers 204, which the client returns as {}.
  def destroy(id:) = write(:delete, "/api/memos/#{id}", {})

  # `{ proposals: ProposalView[] }` (spec §11). A `storeKeys` entry of '' means
  # all stores; the page words it, this proxy passes it through.
  def proposals
    @client.request(verb: :get, path: '/api/memo-proposals', query: { state: 'pending' }, refusals: { NF => [404] })
  end

  def decide(id:, decision:)
    write(:post, "/api/memo-proposals/#{id}/decision", { decision: decision })
  end

  private

  def write(verb, path, body)
    @client.request(verb: verb, path: path, body: body.merge(actor: @actor),
                    checks_error: InvalidError, refusals: { NF => [404], CF => [409] })
  end
end
