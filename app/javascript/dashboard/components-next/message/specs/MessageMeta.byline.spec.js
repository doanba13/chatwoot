import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { withFullI18n } from 'test-i18n';
import MessageMeta from '../MessageMeta.vue';

const context = {};
vi.mock('../provider.js', () => ({ useMessageContext: () => context }));
vi.mock('dashboard/composables/useInbox', () => ({
  // Every channel flag reads false.
  useInbox: () => new Proxy({}, { get: () => ({ value: false }) }),
}));
vi.mock('shared/composables/useExactTimestamp', () => ({
  useExactTimestamp: () => () => 'exact',
}));
withFullI18n();

const setContext = byline =>
  Object.assign(context, {
    status: ref('sent'),
    isPrivate: ref(true),
    createdAt: ref(1759310000),
    sourceId: ref(''),
    messageType: ref(1),
    contentAttributes: ref({}),
    byline: ref(byline),
  });

const mountMeta = () =>
  mount(MessageMeta, {
    global: {
      directives: { tooltip: {} },
      stubs: { MessageStatus: { template: '<i data-status />' } },
    },
  });

describe('MessageMeta under a byline', () => {
  it('repeats neither the time nor the lock when a byline says them', () => {
    setContext({ text: 'Mara · private note', lock: true });
    const wrapper = mountMeta();
    expect(wrapper.find('time').exists()).toBe(false);
    expect(wrapper.html()).not.toContain('lock-keyhole');
  });

  it('keeps the delivery status when the message has one', () => {
    setContext({ text: 'Mara · sent', lock: false });
    context.isPrivate.value = false;
    const wrapper = mountMeta();
    expect(wrapper.find('time').exists()).toBe(false);
    expect(wrapper.find('[data-status]').exists()).toBe(true);
  });

  it('still shows the time with no byline', () => {
    setContext(null);
    expect(mountMeta().find('time').exists()).toBe(true);
  });
});
