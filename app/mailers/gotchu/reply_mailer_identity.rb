# Prepended to ConversationReplyMailer. One shared mailbox answers for several
# stores, and Gmail filed its replies as spam (2026-10-11): the From read
# "<agent> from Support Mailbox" for mail a customer had sent to a store's own
# address, and the Message-ID claimed @gmail.com without Gmail having made it.
#
# - A conversation attributed to a store (custom_attributes.store_key) is
#   answered in that store's name, never an agent's, in upstream's
#   professional format "<business> <address>".
# - GOTCHU_MESSAGE_ID_DOMAIN, when set, is the domain our Message-ID and
#   fallback In-Reply-To carry. The address the mail is sent from is unchanged.
module Gotchu::ReplyMailerIdentity
  private

  def sender_name(sender_email)
    store = gotchu_store_name
    return super if store.blank?

    I18n.t('conversations.reply.email.header.professional_name', business_name: store, from_email: sender_email)
  end

  def channel_email_domain
    ENV['GOTCHU_MESSAGE_ID_DOMAIN'].presence || super
  end

  def gotchu_store_name
    key = @conversation&.custom_attributes&.dig('store_key').to_s.strip
    key.match?(/\A[a-z0-9-]+\z/) ? key.capitalize : nil
  end
end
