import { previewTextFor } from '../previewText';

// The real formatter, not a stub: it markdown-renders before stripping to text,
// and the trailing newline, the typographic substitutions and the escaped-HTML
// behaviour asserted below are all consequences of that which a stub would hide.
import { useMessageFormatter } from 'shared/composables/useMessageFormatter';

const { getPlainText: toPlainText } = useMessageFormatter();

const SUBJECT = 'Aw: Bestellung #PL-5563';

// content_attributes reaches the front end as a NESTED OBJECT. It is a Rails
// `store` over a json column, so Message#content_attributes is a Hash by the
// time the serializer sees it — Message#dig(:email, :text_content, :quoted) is a
// live caller. The double encoding visible in SQL does not survive into the
// payload, so these fixtures are objects rather than JSON strings.
const emailMessage = ({
  content,
  textReply,
  htmlReply,
  subject = SUBJECT,
}) => ({
  content,
  content_attributes: {
    email: {
      subject,
      ...(textReply === undefined
        ? {}
        : { text_content: { full: textReply, reply: textReply } }),
      ...(htmlReply === undefined
        ? {}
        : { html_content: { full: htmlReply, reply: htmlReply } }),
    },
  },
});

// getPlainText renders markdown, so block content comes back with a trailing
// newline. Harmless in an HTML span, and today's previews already return it, so
// it is asserted away here rather than trimmed in the helper.
const preview = (message, options) =>
  previewTextFor(message, { toPlainText, ...options }).trim();

const asCard = { preferSubject: false };

describe('previewTextFor', () => {
  describe('preferSubject: true, which is Chatwoot behaviour and the default', () => {
    it('shows the subject over the body', () => {
      expect(
        preview(
          emailMessage({
            content: 'Wo ist mein Paket?',
            textReply: 'Wo ist mein Paket?',
          })
        )
      ).toBe(SUBJECT);
    });

    it('falls back to the body when there is no subject', () => {
      expect(preview({ content: 'Wo ist mein Paket?' })).toBe(
        'Wo ist mein Paket?'
      );
    });

    it('ignores text_content.reply entirely, so ReplyToMessage is untouched', () => {
      // The new chain must not leak into the default path.
      expect(
        preview(
          emailMessage({
            content: 'the content column',
            textReply: 'the text part',
          })
        )
      ).toBe(SUBJECT);
    });
  });

  describe('preferSubject: false — step 1, the server plain-text body', () => {
    it('prefers text_content.reply, and the precedence is real not incidental', () => {
      // The two deliberately DIFFER here. If the helper fell through to
      // `content` this would read "the content column" and the test would fail,
      // so step 1 cannot pass by accident.
      expect(
        preview(
          emailMessage({
            content: 'the content column',
            textReply: 'the text part',
          }),
          asCard
        )
      ).toBe('the text part');
    });

    it('covers the 87% of email rows that carry a text part', () => {
      expect(
        preview(
          emailMessage({
            content: 'Wo ist mein Paket?',
            textReply: 'Wo ist mein Paket?',
          }),
          asCard
        )
      ).toBe('Wo ist mein Paket?');
    });

    it('is the staging row that read the same string twice', () => {
      const message = emailMessage({
        content: 'Persoliebe September 19, 2026 Inquiry response submitted ---',
        textReply:
          'Persoliebe September 19, 2026 Inquiry response submitted ---',
        subject: 'An inquiry response for order #PL-6487 was submitted',
      });

      expect(preview(message)).toBe(
        'An inquiry response for order #PL-6487 was submitted'
      );
      // markdown-it's typographer folds the trailing `---` into an em dash.
      // Asserted as it really renders rather than as the raw content reads.
      expect(preview(message, asCard)).toBe(
        'Persoliebe September 19, 2026 Inquiry response submitted —'
      );
    });

    it('shows an outgoing agent reply, which reaches step 1 too', () => {
      // MessageBuilder#build_text_content sets text_content.reply to the agent's
      // own body for every non-private outgoing message on an email inbox
      // (message_builder.rb:192), and sets no subject. So our replies resolve at
      // step 1 exactly as inbound mail does. Pinned because step 2 preferring a
      // subject over `content` must never hide our own replies behind it.
      expect(
        preview(
          {
            content: 'Ihre Sendung ist unterwegs.',
            message_type: 1,
            content_attributes: {
              cc_emails: [],
              bcc_emails: [],
              to_emails: [],
              email: {
                text_content: {
                  full: 'Ihre Sendung ist unterwegs.',
                  reply: 'Ihre Sendung ist unterwegs.',
                },
                html_content: { reply: '<p>Ihre Sendung ist unterwegs.</p>' },
              },
            },
          },
          asCard
        )
      ).toBe('Ihre Sendung ist unterwegs.');
    });
  });

  describe('preferSubject: false — step 2, an email with no text part', () => {
    // 270 of 3341 email rows on staging. `content` holds raw HTML for these, and
    // markdown-it escapes rather than parses it, so `content` would render as
    // visible markup.
    const htmlOnly = (subject = SUBJECT) =>
      emailMessage({
        content: '<div style="font-family:Arial">Wo ist mein Paket?</div>',
        htmlReply: '<div style="font-family:Arial">Wo ist mein Paket?</div>',
        subject,
      });

    it('lands on the subject, not on markup', () => {
      const text = preview(htmlOnly(), asCard);

      expect(text).toBe(SUBJECT);
      expect(text).not.toContain('<div');
      expect(text).not.toContain('font-family');
    });

    it('is no regression for those rows, because they show the subject today', () => {
      // Same string either way: this is the population the fallback is priced
      // against, and it is where the duplicate knowingly remains.
      expect(preview(htmlOnly())).toBe(preview(htmlOnly(), asCard));
    });

    it('still prefers a text part over the subject when one exists', () => {
      // Guards the step-2 branch from widening into "emails always show the
      // subject", which would undo the whole change.
      expect(
        preview(
          emailMessage({
            content: '<div>ignored</div>',
            textReply: 'Wo ist mein Paket?',
            htmlReply: '<div>ignored</div>',
          }),
          asCard
        )
      ).toBe('Wo ist mein Paket?');
    });

    it('falls all the way to content when there is no subject either', () => {
      // Step 4. Markup, but better than an empty line — the template has already
      // taken its `message.content` branch and there is no empty state left.
      // `null` rather than undefined, so the fixture default does not reinstate
      // a subject.
      expect(preview(htmlOnly(null), asCard)).toContain('Wo ist mein Paket?');
    });
  });

  describe('preferSubject: false — step 3, a non-email row', () => {
    // 192 of 3533. No email key at all, `content` is plain, no HTML risk.
    it('uses content', () => {
      expect(preview({ content: 'Wo ist mein Paket?' }, asCard)).toBe(
        'Wo ist mein Paket?'
      );
    });

    it('is unaffected by the email-only step 2', () => {
      expect(
        preview({ content: '<div>a widget message</div>' }, asCard)
      ).toContain('a widget message');
    });

    it('covers a private note, which gets no email key even on a mail inbox', () => {
      // should_process_email_content? requires !private, so MessageBuilder adds
      // no `email` key here and the note's own text is what shows.
      expect(
        preview(
          {
            content: 'Kunde hat zweimal geschrieben.',
            private: true,
            content_attributes: { cc_emails: [], bcc_emails: [] },
          },
          asCard
        )
      ).toBe('Kunde hat zweimal geschrieben.');
    });
  });

  describe('preferSubject: false — blank bodies', () => {
    it.each([
      ['an empty body', ''],
      ['whitespace only', '   '],
      ['newlines only', '\n\n'],
    ])('falls back to the subject on %s', (_label, content) => {
      expect(
        preview(emailMessage({ content, textReply: content }), asCard)
      ).toBe(SUBJECT);
    });

    it('returns an empty string when there is neither a body nor a subject', () => {
      expect(preview({ content: '' }, asCard)).toBe('');
    });

    it('does not throw on a message it was handed nothing for', () => {
      expect(preview(undefined)).toBe('');
      expect(preview(undefined, asCard)).toBe('');
    });
  });
});
