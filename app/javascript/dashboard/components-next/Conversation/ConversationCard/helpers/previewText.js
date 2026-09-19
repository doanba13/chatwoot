/**
 * The text a conversation card's preview line should show.
 *
 * WHY THIS IS NOT JUST `message.content`. Chatwoot's previews have always
 * rendered `subject || content` for an email message — the subject WINS over the
 * body. That predates this fork and is why a card row could only ever show one
 * of the two, so the desk has never seen the message body in the list for email
 * traffic, which is nearly all of it. Once a card draws the subject on a line of
 * its own, that preference makes the row read subject + subject: byte-identical
 * lines, which is what staging showed on conversation 3592.
 *
 * So `preferSubject` defaults to TRUE and keeps Chatwoot's behaviour for every
 * caller that has no subject line of its own — ReplyToMessage is the only one
 * left. A card that renders the subject itself passes false and gets the chain
 * below instead.
 *
 * THE CHAIN, when `preferSubject` is false. Measured over the 3533 last
 * non-activity messages on staging, of which 3341 (95%) are email:
 *
 *   1. `email.text_content.reply` — the server's own plain-text body, present on
 *      3071 of 3341 email rows (87%). `content` is set from this same value
 *      (`MailboxHelper#mail_content`) modulo null-byte stripping and a 150k
 *      truncate, so for these rows this step and the next agree; taking it first
 *      is what makes step 2 safe to skip.
 *
 *   2. For an email with NO text part — 270 of 3341 (8%) — `content` holds the
 *      raw HTML instead (`mail_content` falls through to `html_content[:reply]`).
 *      `toPlainText` markdown-renders and then takes `textContent`, and
 *      markdown-it ESCAPES raw HTML rather than parsing it, so `content` would
 *      render as visible markup. So an email row prefers its SUBJECT over
 *      `content` here. That reintroduces the duplicate on ~8% of rows and is
 *      the right trade: those rows show the subject today, so the fallback is no
 *      regression for them, where markup would be a new one. Priced against
 *      270/3341 — revisit if the mail mix changes.
 *
 *   3. A non-email row (192 of 3533) has no HTML risk: `content` is plain, so it
 *      is preferred over a subject it does not have anyway.
 *
 *   4. `content` remains the last resort for an email with neither a text part
 *      nor a subject. Markup is still better than an empty line, and the
 *      caller's own empty-state branch cannot be reached from here: the preview
 *      templates branch on `message.content` being truthy, so by the time this
 *      runs that branch is already taken and returning '' renders nothing at all.
 *
 * Deliberately NOT here: an HTML stripper. Stripping tags ourselves would be a
 * second, divergent renderer for the same content, and the 8% has a correct
 * answer already.
 *
 * @param {Object} message A message in the server's casing. `content_attributes`
 *   arrives as a nested object: it is a Rails `store` over a json column, so the
 *   model hands the serializer a Hash (see Message#content_attributes and its
 *   `dig(:email, :text_content, :quoted)` caller). The double encoding visible
 *   in SQL does not survive into the payload.
 * @param {Object} options
 * @param {boolean} [options.preferSubject=true] False when the caller draws the
 *   subject itself.
 * @param {Function} options.toPlainText `getPlainText` from useMessageFormatter.
 * @returns {string} The preview text.
 */
export const previewTextFor = (
  message,
  { preferSubject = true, toPlainText }
) => {
  const { content_attributes: contentAttributes, content } = message ?? {};
  const email = contentAttributes?.email;
  const subject = email?.subject;

  // Every candidate goes through the same formatter the preview has always
  // used, so a body reads identically whichever step produced it.
  const plain = value => (value ? toPlainText(value) : '');

  // Candidates are thunks, and the reduce short-circuits on the first hit, so a
  // row that resolves at step 1 never pays for steps 2 and 3. This runs once per
  // visible row and each call is a markdown render, so that matters.
  const firstNonBlank = (...candidates) =>
    candidates.reduce((found, candidate) => {
      if (found) return found;
      const value = plain(candidate());
      return value.trim() ? value : '';
    }, '');

  if (preferSubject) return plain(subject || content);

  const textReply = () => email?.text_content?.reply;

  return email
    ? firstNonBlank(
        textReply,
        () => subject,
        () => content
      )
    : firstNonBlank(
        textReply,
        () => content,
        () => subject
      );
};
