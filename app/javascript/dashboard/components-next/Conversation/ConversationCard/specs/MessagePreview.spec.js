import { mount } from '@vue/test-utils';
import MessagePreview from '../MessagePreview.vue';

const SUBJECT = 'Rép: Commande #PP-2201';

// A text mail: `text_content.reply` is the first step of the preview chain, and
// a fixture without it reads as an HTML-only row instead.
const emailMessage = (content, subject = SUBJECT) => ({
  content,
  content_attributes: {
    email: { subject, text_content: { full: content, reply: content } },
  },
  message_type: 0,
  attachments: [],
});

const mountComponent = (message, props = {}) =>
  mount(MessagePreview, { props: { message, ...props } });

describe('MessagePreview preferSubject', () => {
  it('prefers the subject by default, keeping Chatwoot behaviour', () => {
    const wrapper = mountComponent(emailMessage('Où est mon colis ?'));

    expect(wrapper.text()).toContain(SUBJECT);
    expect(wrapper.text()).not.toContain('Où est mon colis ?');
  });

  it('shows the body instead when the caller draws the subject itself', () => {
    const wrapper = mountComponent(emailMessage('Où est mon colis ?'), {
      preferSubject: false,
    });

    expect(wrapper.text()).toContain('Où est mon colis ?');
    expect(wrapper.text()).not.toContain(SUBJECT);
  });

  it('shows the subject, not markup, when the mail has no text part', () => {
    const wrapper = mountComponent(
      {
        content: '<div>Où est mon colis ?</div>',
        content_attributes: {
          email: { subject: SUBJECT, html_content: { reply: '<div>x</div>' } },
        },
        message_type: 0,
        attachments: [],
      },
      { preferSubject: false }
    );

    expect(wrapper.text()).toContain(SUBJECT);
    expect(wrapper.text()).not.toContain('<div');
  });

  it('shows the subject rather than a blank line when the body is whitespace', () => {
    const wrapper = mountComponent(emailMessage('  '), {
      preferSubject: false,
    });

    expect(wrapper.text().trim()).not.toBe('');
    expect(wrapper.text()).toContain(SUBJECT);
  });
});
