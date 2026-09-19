import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import ConversationCard from '../ConversationCard.vue';

// The real catalogue: the unassigned state's copy comes out of the locale files
// and under `t: key => key` it would read as a key, which would let a wrong key
// pass.
withFullI18n();

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ params: { accountId: 1 } }),
}));

const CONTACT = { id: 7, name: 'Anja Keller', availabilityStatus: 'offline' };
const INBOX = { id: 1, name: 'Support Mail', channelType: 'Channel::Email' };

// An email conversation as the two history lists hand it over: deep-camelCased,
// so `mail_subject` arrives as `mailSubject`.
const emailConversation = (overrides = {}) => ({
  id: 4471,
  timestamp: 1730885168,
  priority: null,
  labels: [],
  unreadCount: 0,
  inboxId: 1,
  meta: { sender: CONTACT, channel: 'Channel::Email' },
  additionalAttributes: { mailSubject: 'Aw: Bestellung #PL-5563' },
  lastNonActivityMessage: {
    id: 3591,
    content: 'Wo ist mein Paket?',
    messageType: 0,
    // The subject rides on the message too, which is what made the preview
    // render it: Chatwoot's previews prefer it over the body. `textContent` is
    // here because the preview chain reads text_content.reply first, and it is
    // written camelCased on purpose — the preview wrappers snake-case the
    // conversation before handing it over, so this exercises that too.
    contentAttributes: {
      email: {
        subject: 'Aw: Bestellung #PL-5563',
        textContent: {
          full: 'Wo ist mein Paket?',
          reply: 'Wo ist mein Paket?',
        },
      },
    },
    attachments: [],
  },
  ...overrides,
});

const mountCard = (conversation = emailConversation(), props = {}) =>
  mount(ConversationCard, {
    props: {
      conversation,
      contact: CONTACT,
      stateInbox: INBOX,
      accountLabels: [],
      ...props,
    },
    global: {
      // The two previews are not what these tests are about, and the meta one
      // mounts an SLA label that wants its own fixtures.
      stubs: {
        CardMessagePreview: true,
        CardMessagePreviewWithMeta: true,
      },
    },
  });

const subject = wrapper => wrapper.find('[data-testid="card-subject"]');
const assignment = wrapper =>
  wrapper.find('[data-testid="card-assignment-state"]');
// The avatar renders the assignee's initial as text, so the state's own copy has
// to be read off the label rather than off the whole line.
const assignmentLabel = wrapper =>
  wrapper.find('[data-testid="card-assignment-label"]');
const placeholder = wrapper =>
  wrapper.find('[data-testid="card-assignment-placeholder"]');
const root = wrapper => wrapper.find('div[role="button"]');

describe('ConversationCard subject line', () => {
  it('renders the mail subject', () => {
    expect(subject(mountCard()).text()).toBe('Aw: Bestellung #PL-5563');
  });

  it('reads the subject under the server spelling too', () => {
    // The story fixture and anything that has not been camelCased carry
    // `mail_subject`; both spellings reach this card depending on the caller.
    const wrapper = mountCard(
      emailConversation({
        additionalAttributes: { mail_subject: 'Fehlende Bestellung PL5713' },
      })
    );

    expect(subject(wrapper).text()).toBe('Fehlende Bestellung PL5713');
  });

  it('carries the full subject as a title, since the line truncates', () => {
    const wrapper = mountCard();

    expect(subject(wrapper).attributes('title')).toBe(
      'Aw: Bestellung #PL-5563'
    );
    expect(subject(wrapper).classes()).toContain('truncate');
  });

  it('renders nothing at all when there is no subject', () => {
    // A Messenger or web-widget conversation: no mail ever created it, so the
    // attribute does not exist. An empty line would read as "this thread has no
    // subject", which is a different claim, so the element must be absent
    // rather than blank.
    const wrapper = mountCard(
      emailConversation({
        additionalAttributes: {},
        meta: { sender: CONTACT, channel: 'Channel::FacebookPage' },
      })
    );

    expect(subject(wrapper).exists()).toBe(false);
  });

  it('renders nothing when additionalAttributes is missing entirely', () => {
    const conversation = emailConversation();
    delete conversation.additionalAttributes;

    expect(subject(mountCard(conversation)).exists()).toBe(false);
  });

  it('renders nothing when the subject is present but empty', () => {
    const wrapper = mountCard(
      emailConversation({ additionalAttributes: { mailSubject: '' } })
    );

    expect(subject(wrapper).exists()).toBe(false);
  });
});

describe('ConversationCard selected row', () => {
  it('marks a selected row with the agent border and the tank surface', () => {
    const classes = root(mountCard(emailConversation(), { selected: true }))
      .classes()
      .join(' ');

    // The accent is the 3px inline-start border, not the background alone.
    expect(classes).toContain('border-s-[3px]');
    expect(classes).toContain('!border-s-[var(--g-agent)]');
    expect(classes).toContain('bg-[var(--g-surface-tank)]');
  });

  it('leaves the border transparent and the surface alone when unselected', () => {
    const classes = root(mountCard()).classes().join(' ');

    // The border box is always reserved, so selecting a row cannot shift its
    // content sideways.
    expect(classes).toContain('border-s-[3px]');
    expect(classes).toContain('border-s-transparent');
    expect(classes).not.toContain('!border-s-[var(--g-agent)]');
    expect(classes).not.toContain('bg-[var(--g-surface-tank)]');
  });

  it('announces the selection to anyone not reading the colour', () => {
    expect(
      root(mountCard(emailConversation(), { selected: true })).attributes(
        'aria-current'
      )
    ).toBe('true');
    expect(root(mountCard()).attributes('aria-current')).toBeUndefined();
  });

  it('keeps the affordance the card already had', () => {
    expect(root(mountCard()).exists()).toBe(true);
  });
});

describe('ConversationCard assignment state', () => {
  const assignedToHuman = () =>
    emailConversation({
      meta: {
        sender: CONTACT,
        channel: 'Channel::Email',
        assignee: {
          id: 3,
          name: 'Sivin',
          availableName: 'Sivin',
          thumbnail: '',
          availabilityStatus: 'online',
        },
        assigneeType: 'User',
      },
    });

  it('names the human holding the conversation, in the default text colour', () => {
    const wrapper = mountCard(assignedToHuman());

    expect(assignmentLabel(wrapper).text()).toBe('Sivin');
    expect(assignment(wrapper).classes()).toContain('text-[var(--g-text)]');
    expect(placeholder(wrapper).exists()).toBe(false);
  });

  it('shows the assignee avatar at the 14px the design asks for', () => {
    const wrapper = mountCard(assignedToHuman());
    const avatar = assignment(wrapper).findComponent(Avatar);

    expect(avatar.exists()).toBe(true);
    expect(avatar.props('name')).toBe('Sivin');
    expect(avatar.props('size')).toBe(14);
  });

  it('falls back to availableName when that is all the serializer gave', () => {
    const wrapper = mountCard(
      emailConversation({
        meta: {
          sender: CONTACT,
          channel: 'Channel::Email',
          assignee: { id: 3, availableName: 'Sivin' },
        },
      })
    );

    expect(assignmentLabel(wrapper).text()).toBe('Sivin');
  });

  it('draws a dashed placeholder and muted copy when nobody is assigned', () => {
    const wrapper = mountCard();

    expect(assignmentLabel(wrapper).text()).toBe('Unassigned');
    expect(assignment(wrapper).classes()).toContain(
      'text-[var(--g-text-muted)]'
    );
    expect(assignment(wrapper).findComponent(Avatar).exists()).toBe(false);

    const dashed = placeholder(wrapper).classes().join(' ');
    expect(dashed).toContain('border-dashed');
    expect(dashed).toContain('size-[14px]');
    expect(dashed).toContain('border-[var(--g-border-strong)]');
  });

  it('shows the state on every row, assigned or not', () => {
    expect(assignment(mountCard()).exists()).toBe(true);
    expect(assignment(mountCard(assignedToHuman())).exists()).toBe(true);
  });

  it('never renders the gotchu state, which has no signal behind it yet', () => {
    // Chatwoot has no field identifying the agent as an assignee — it replies
    // as an ordinary User — so no input to this card may produce the agent
    // colour. An AgentBot assignee is the nearest thing available and must not
    // be mistaken for it.
    const wrapper = mountCard(
      emailConversation({
        meta: {
          sender: CONTACT,
          channel: 'Channel::Email',
          assignee: { id: 9, name: 'Gotchu' },
          assigneeType: 'AgentBot',
        },
      })
    );

    expect(assignment(wrapper).classes()).not.toContain(
      'text-[var(--g-agent)]'
    );
    expect(assignment(wrapper).classes()).toContain('text-[var(--g-text)]');
  });
});

describe('ConversationCard with its previews mounted for real', () => {
  // These two are about what the previews themselves render, so they cannot use
  // the stubs the rest of this file does.
  const mountWithPreviews = conversation =>
    mount(ConversationCard, {
      props: {
        conversation,
        contact: CONTACT,
        stateInbox: INBOX,
        accountLabels: [],
      },
    });

  it('gives both previews the body, not the subject the card already shows', () => {
    // The staging duplicate, end to end: the subject line and the preview line
    // read the same string when the preview is left to prefer the subject.
    const wrapper = mountWithPreviews(emailConversation());
    const previews = wrapper.findAllComponents({ name: 'MessagePreview' });

    expect(previews.length).toBeGreaterThan(0);
    previews.forEach(preview => {
      expect(preview.props('preferSubject')).toBe(false);
      expect(preview.text()).toContain('Wo ist mein Paket?');
      expect(preview.text()).not.toContain('Aw: Bestellung #PL-5563');
    });

    expect(wrapper.find('[data-testid="card-subject"]').text()).toBe(
      'Aw: Bestellung #PL-5563'
    );
  });

  it('draws the assignee exactly once, beside the contact', () => {
    const conversation = emailConversation({
      meta: {
        sender: CONTACT,
        channel: 'Channel::Email',
        assignee: { id: 3, name: 'Sivin', availabilityStatus: 'online' },
      },
    });

    const avatars = mountWithPreviews(conversation).findAllComponents(Avatar);

    // The contact's, and the assignment line's. Nothing else.
    expect(avatars).toHaveLength(2);
    expect(avatars.map(avatar => avatar.props('size'))).toEqual([24, 14]);
  });
});
