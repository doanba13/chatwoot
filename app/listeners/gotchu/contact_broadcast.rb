# Prepended to ActionCableListener. A payload carrying a sent-draft stamp goes
# to agents with it and to the contact's tokens without it
# (Gotchu::CustomerPayload); anything else is one broadcast, exactly as
# upstream. Done at #broadcast so every event a contact receives -- message and
# conversation alike -- goes through it.
module Gotchu::ContactBroadcast
  private

  def broadcast(account, tokens, event_name, data)
    customer_data = Gotchu::CustomerPayload.strip(data)
    return super if customer_data.equal?(data) || tokens.blank?

    contact_tokens = ContactInbox.where(pubsub_token: tokens).pluck(:pubsub_token)
    super(account, tokens - contact_tokens, event_name, data)
    super(account, contact_tokens, event_name, customer_data)
  end
end
