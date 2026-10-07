import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import MessageList from '../MessageList.vue';

vi.mock('dashboard/composables/store.js', () => ({
  useMapGetter: () => ({ value: null }),
}));
withFullI18n();

const message = {
  id: 501,
  message_type: 1,
  private: false,
  content: 'Hallo',
  created_at: 1759310000,
  sender: { name: 'Anna' },
  content_attributes: {},
};

const sent = {
  messageId: 501,
  cycleId: 12,
  version: 1,
  edited: false,
  author: 'model',
  sentBy: 'agent',
  trace: [{ kind: 'tier', tier: 'draft', channel: 'email', refusal: null }],
};

const Message = {
  props: ['byline', 'sentTrace'],
  template:
    '<li><span>{{ byline && byline.text }}</span><span>{{ sentTrace.length }} steps</span></li>',
};

const mountList = props =>
  mount(MessageList, {
    props: { currentUserId: 1, messages: [message], ...props },
    global: { stubs: { Message } },
  });

describe('MessageList Gotchu wiring', () => {
  it('puts the byline above a reply that came from a draft, and its trace under it', () => {
    const wrapper = mountList({
      sentDraftFor: id => (id === 501 ? sent : null),
      channelWord: 'Email',
    });
    expect(wrapper.text()).toContain('Anna · sent Gotchu’s draft v1 unedited');
    expect(wrapper.text()).toContain('1 steps');
  });

  it('draws a plain byline and no Gotchu line when the gateway says nothing', () => {
    const wrapper = mountList();
    expect(wrapper.text()).toContain('Anna');
    expect(wrapper.text()).not.toContain('Gotchu');
    expect(wrapper.text()).toContain('0 steps');
  });

  it('opens each day and words a timeline line between messages', () => {
    const wrapper = mountList({
      timeline: [
        {
          kind: 'drafted',
          at: '2025-10-01T09:00:00.000Z',
          procedureTitle: 'Where is my order',
        },
      ],
    });
    expect(wrapper.text()).toContain(
      'Gotchu matched “Where is my order” and drafted a reply'
    );
  });
});
