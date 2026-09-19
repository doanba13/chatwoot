import { mount } from '@vue/test-utils';
import MessagePreview from '../MessagePreview.vue';

const SUBJECT = 'Aw: Bestellung #PL-5563';

// A text mail: `text_content.reply` is what 87% of email rows carry and is the
// first step of the preview chain. Without it a fixture reads as an HTML-only
// row, which resolves to the subject instead — see the block at the bottom.
const emailMessage = (content, subject = SUBJECT) => ({
  content,
  content_attributes: {
    email: { subject, text_content: { full: content, reply: content } },
  },
  message_type: 0,
  attachments: [],
});

// The 270-of-3341 population: no text part, so `content` holds raw HTML.
const htmlOnlyMessage = (subject = SUBJECT) => ({
  content: '<div style="font-family:Arial">Wo ist mein Paket?</div>',
  content_attributes: {
    email: {
      subject,
      html_content: {
        reply: '<div style="font-family:Arial">Wo ist mein Paket?</div>',
      },
    },
  },
  message_type: 0,
  attachments: [],
});

const mountComponent = (message, props = {}) =>
  mount(MessagePreview, {
    props: { message, ...props },
    global: { stubs: { 'fluent-icon': true } },
  });

describe('MessagePreview preferSubject', () => {
  it('prefers the subject by default, which is what ReplyToMessage relies on', () => {
    // Chatwoot's long-standing behaviour. The default must not move: this
    // component is shared with the reply composer, which has no subject line of
    // its own to fall back on.
    const wrapper = mountComponent(emailMessage('Wo ist mein Paket?'));

    expect(wrapper.text()).toContain(SUBJECT);
    expect(wrapper.text()).not.toContain('Wo ist mein Paket?');
  });

  it('shows the body instead when the caller draws the subject itself', () => {
    const wrapper = mountComponent(emailMessage('Wo ist mein Paket?'), {
      preferSubject: false,
    });

    expect(wrapper.text()).toContain('Wo ist mein Paket?');
    expect(wrapper.text()).not.toContain(SUBJECT);
  });

  it('shows the subject rather than a blank line when the body is whitespace', () => {
    // The row knowingly duplicates here: the template has already taken its
    // `message.content` branch, so there is no empty state left to fall into.
    const wrapper = mountComponent(emailMessage('   '), {
      preferSubject: false,
    });

    expect(wrapper.text().trim()).not.toBe('');
    expect(wrapper.text()).toContain(SUBJECT);
  });

  it('shows the subject, not markup, when the mail has no text part', () => {
    // markdown-it escapes raw HTML rather than parsing it, so `content` here
    // would render as visible tags. Those rows show the subject today, so this
    // is no regression for them — it is the knowing duplicate.
    const wrapper = mountComponent(htmlOnlyMessage(), { preferSubject: false });

    expect(wrapper.text()).toContain(SUBJECT);
    expect(wrapper.text()).not.toContain('<div');
    expect(wrapper.text()).not.toContain('font-family');
  });

  it('still uses the body when there is no subject at all', () => {
    const wrapper = mountComponent(
      { content: 'Hallo', message_type: 0, attachments: [] },
      { preferSubject: false }
    );

    expect(wrapper.text()).toContain('Hallo');
  });
});
