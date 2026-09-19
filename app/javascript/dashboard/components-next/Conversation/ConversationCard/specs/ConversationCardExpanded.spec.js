import { shallowMount } from '@vue/test-utils';
import ConversationCardExpanded from '../ConversationCardExpanded.vue';

// shallowMount on purpose: this row mounts a dozen children (checkbox, status
// icons, SLA label, TimeAgo) that each want their own fixtures, and none of them
// is what these tests are about.
const mountComponent = (chat = {}, props = {}) =>
  shallowMount(ConversationCardExpanded, {
    props: {
      chat: {
        id: 4471,
        labels: [],
        messages: [],
        priority: null,
        status: 'open',
        unread_count: 0,
        timestamp: 1730885168,
        created_at: 1730836533,
        ...chat,
      },
      currentContact: { name: 'Anja Keller' },
      inbox: { id: 1, name: 'Support Mail' },
      ...props,
    },
  });

const subject = wrapper => wrapper.find('[data-testid="card-subject"]');
const rootClasses = wrapper =>
  wrapper.find('div.conversation').classes().join(' ');

describe('ConversationCardExpanded subject line', () => {
  it('renders the mail subject in the server casing this store keeps', () => {
    const wrapper = mountComponent({
      additional_attributes: { mail_subject: 'Rép: Commande #PP-2201' },
    });

    expect(subject(wrapper).text()).toBe('Rép: Commande #PP-2201');
  });

  it('renders nothing at all on a channel that had no mail', () => {
    expect(subject(mountComponent()).exists()).toBe(false);
  });

  it('renders nothing when the attribute exists but carries no subject', () => {
    const wrapper = mountComponent({ additional_attributes: {} });

    expect(subject(wrapper).exists()).toBe(false);
  });

  it('truncates rather than wrapping, since the row is a fixed height', () => {
    const wrapper = mountComponent({
      additional_attributes: { mail_subject: 'Rép: Commande #PP-2201' },
    });

    expect(subject(wrapper).classes()).toContain('truncate');
    expect(rootClasses(wrapper)).toContain('h-12');
  });
});

describe('ConversationCardExpanded preview', () => {
  it('tells CardContent not to prefer the subject, or both lines match', () => {
    expect(
      mountComponent()
        .findComponent({ name: 'CardContent' })
        .props('preferSubject')
    ).toBe(false);
  });
});

describe('ConversationCardExpanded selected row', () => {
  // Checked rather than assumed: this row is where the treatment was copied
  // from, so these tests pin it in place rather than change it.
  it('already marks the active row with the agent border and the tank surface', () => {
    const classes = rootClasses(mountComponent({}, { isActiveChat: true }));

    expect(classes).toContain('!border-s-[var(--g-agent)]');
    expect(classes).toContain('bg-[var(--g-surface-tank)]');
  });

  it('already marks a bulk-selected row the same way', () => {
    const classes = rootClasses(mountComponent({}, { selected: true }));

    expect(classes).toContain('!border-s-[var(--g-agent)]');
    expect(classes).toContain('bg-[var(--g-surface-tank)]');
  });

  it('reserves the border box when neither, so nothing shifts sideways', () => {
    const classes = rootClasses(mountComponent());

    expect(classes).toContain('border-s-[3px]');
    expect(classes).toContain('border-s-transparent');
    expect(classes).not.toContain('!border-s-[var(--g-agent)]');
  });
});
