/**
 * The email subject of a conversation, as an agent scanning the list needs it.
 *
 * WHERE IT COMES FROM. Chatwoot has no subject field of its own on the
 * conversation serializer, and the copy an agent wants belongs to the FIRST
 * inbound message (`content_attributes.email.subject`) — which no conversation
 * card receives, because the list payload carries only the latest message plus
 * `last_non_activity_message`.
 *
 * It does not have to. Both inbound email paths write that same first subject
 * onto the conversation when they create it:
 *
 *   - Mailbox::ConversationFinderStrategies::NewConversationStrategy
 *       #build_conversation
 *   - Imap::ImapMailbox#find_or_create_conversation
 *
 * both setting `additional_attributes.mail_subject`, and neither rewriting it
 * when a later reply lands on the thread. So the attribute IS the first inbound
 * subject, and it already rides in every conversation payload via
 * `json.additional_attributes` in
 * `app/views/api/v1/conversations/partials/_conversation.json.jbuilder`.
 * ConversationHeader.vue has been reading the same field all along.
 *
 * WHY FOUR SPELLINGS ARE ACCEPTED, which is the part that reads as redundant
 * and must not be tidied away. Both casings are live in this dashboard at the
 * same time, and which one a card gets depends purely on which store handed it
 * the conversation:
 *
 *   - the main conversations store keeps the server's own casing, so the inbox
 *     list's cards see `additional_attributes.mail_subject` — this is the case
 *     that matters most, since it is the list the desk scans all day;
 *   - the contact and company history stores run
 *     `camelcaseKeys(payload, { deep: true })`, so the sidebar card sees
 *     `additionalAttributes.mailSubject`.
 *
 * Deleting either branch silently blanks the subject on half the surfaces that
 * show it, and blank is indistinguishable from "this thread has no subject".
 *
 * Returns '' for every conversation that has no subject — a Messenger or
 * web-widget thread was never created by a mail, so the attribute does not
 * exist. Callers must render nothing at all on '' rather than an empty line.
 *
 * @param {Object} conversation A conversation in either casing.
 * @returns {string} The subject, or '' when there is none.
 */
export const mailSubjectFor = conversation => {
  const attributes =
    conversation?.additionalAttributes ??
    conversation?.additional_attributes ??
    {};

  return attributes.mailSubject || attributes.mail_subject || '';
};
