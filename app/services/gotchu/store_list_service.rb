# The store list every agent can read (agent-screens plan, decision 7): store
# keys, names and inbox ids, for scope pickers, store dots and the rail.
#
# It reads the same gateway route the administrator-only store-routes screen
# reads, and drops `shopEmails` on purpose: a supporter picking a scope needs
# no shop addresses. The inbox lists are narrowed here, not at the gateway,
# because only the fork knows the signed-in agent (spec §11).
class Gotchu::StoreListService
  PATH = '/api/stores/routes'.freeze

  def initialize(account_id:)
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  # `allowed_inbox_ids` is nil for an administrator (every inbox), or the
  # agent's assigned inbox ids. The store entries themselves are kept either
  # way: a store with none of the agent's inboxes is still a store they may
  # scope a memo to.
  def list(allowed_inbox_ids:)
    payload = @client.request(verb: :get, path: PATH, refusals: { Gotchu::GatewayClient::NotFoundError => [404] })
    allowed = ->(id) { allowed_inbox_ids.nil? || allowed_inbox_ids.include?(id) }
    {
      'stores' => Array(payload['stores']).map { |store| store_view(store, allowed) },
      'inboxes' => Array(payload['inboxes']).select { |inbox| allowed.call(inbox['id']) }.map { |inbox| inbox_view(inbox) }
    }
  end

  private

  def store_view(store, allowed)
    {
      'key' => store['key'],
      'name' => store['name'],
      'inboxes' => Array(store['inboxes']).select { |inbox| allowed.call(inbox['id']) }
                                          .map { |inbox| { 'id' => inbox['id'], 'channel' => inbox['channel'] } }
    }
  end

  def inbox_view(inbox)
    { 'id' => inbox['id'], 'name' => inbox['name'], 'channel' => inbox['channel'] }
  end
end
