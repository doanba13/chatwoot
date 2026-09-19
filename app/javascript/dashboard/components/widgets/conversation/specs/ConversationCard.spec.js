import { shallowMount } from '@vue/test-utils';
import ConversationCard from '../ConversationCard.vue';

const defaultChat = {
  id: 1,
  labels: [],
  messages: [],
  priority: null,
  unread_count: 0,
  timestamp: 1700000000,
  created_at: 1700000000,
};

const mountComponent = (chat, currentContact = {}) =>
  shallowMount(ConversationCard, {
    props: {
      chat: { ...defaultChat, ...chat },
      currentContact: {
        name: 'Jane Doe',
        thumbnail: '',
        availability_status: 'offline',
        ...currentContact,
      },
      inbox: { id: 1 },
    },
    global: {
      stubs: {
        'fluent-icon': true,
      },
    },
  });

describe('ConversationCard', () => {
  it('does not reserve the labels row when only a persisted SLA policy id is present', () => {
    const wrapper = mountComponent({ sla_policy_id: 1, applied_sla: null });

    expect(wrapper.findComponent({ name: 'CardLabels' }).exists()).toBe(false);
  });

  it('shows the labels row when an active applied SLA is present', () => {
    const wrapper = mountComponent({
      sla_policy_id: 1,
      applied_sla: { id: 1 },
    });

    expect(wrapper.findComponent({ name: 'CardLabels' }).exists()).toBe(true);
  });

  it('does not reserve the labels row when the contact is blocked', () => {
    const wrapper = mountComponent(
      {
        sla_policy_id: 1,
        applied_sla: { id: 1 },
      },
      { blocked: true }
    );

    expect(wrapper.findComponent({ name: 'CardLabels' }).exists()).toBe(false);
  });

  // The condensed row is the default layout of the inbox list, so this is where
  // the subject earns its keep: a fair number of order-bearing email threads
  // name the order nowhere but the subject, and until now that row showed none.
  describe('subject line', () => {
    const subject = wrapper => wrapper.find('[data-testid="card-subject"]');

    it('renders the mail subject in the server casing this store keeps', () => {
      const wrapper = mountComponent({
        additional_attributes: { mail_subject: 'Aw: Bestellung #PL-5563' },
      });

      expect(subject(wrapper).text()).toBe('Aw: Bestellung #PL-5563');
      expect(subject(wrapper).attributes('title')).toBe(
        'Aw: Bestellung #PL-5563'
      );
    });

    it('renders nothing at all on a channel that had no mail', () => {
      // Messenger and the web widget never get the attribute. A blank line reads
      // as "this thread has no subject", which is a different claim.
      expect(subject(mountComponent({})).exists()).toBe(false);
    });

    it('tells the preview not to prefer the subject, or both lines match', () => {
      // The duplication staging showed. The card draws the subject itself now,
      // so the preview below it has to carry the body instead.
      const wrapper = mountComponent({
        additional_attributes: { mail_subject: 'Aw: Bestellung #PL-5563' },
        last_non_activity_message: {
          id: 1,
          content: 'Wo ist mein Paket?',
          message_type: 0,
          content_attributes: { email: { subject: 'Aw: Bestellung #PL-5563' } },
          attachments: [],
        },
      });

      expect(
        wrapper.findComponent({ name: 'MessagePreview' }).props('preferSubject')
      ).toBe(false);
    });

    it('leaves the unread badge room, the same way the preview does', () => {
      const unread = mountComponent({
        unread_count: 3,
        additional_attributes: { mail_subject: 'Wg: PL-5713' },
      });
      const read = mountComponent({
        additional_attributes: { mail_subject: 'Wg: PL-5713' },
      });

      expect(subject(unread).classes()).toContain('ltr:pr-4');
      expect(subject(read).classes()).not.toContain('ltr:pr-4');
    });
  });
});
