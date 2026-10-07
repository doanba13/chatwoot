# Reads spec §3.2 and §3.3 for one conversation. A 404 is a gateway that
# predates the routes (spec §5: the fork must tolerate it), so it reads as an
# empty list and `available: false`, never as an error.
class Gotchu::ThreadService
  NF = Gotchu::GatewayClient::NotFoundError

  def initialize(conversation:, account_id:)
    @conversation = conversation
    @client = Gotchu::GatewayClient.new(account_id: account_id)
  end

  def perform
    sent, sent_ok = items_at('sent-drafts')
    timeline, timeline_ok = items_at('timeline')
    { 'sentDrafts' => sent, 'timeline' => timeline, 'available' => sent_ok && timeline_ok }
  end

  private

  def items_at(leaf)
    payload = @client.request(verb: :get, path: "/api/conversations/#{@conversation.display_id}/#{leaf}", refusals: { NF => [404] })
    items = payload['items']
    [items.is_a?(Array) ? items.select { |i| i.is_a?(Hash) } : [], true]
  rescue NF
    [[], false]
  end
end
