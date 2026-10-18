import { defineComponent, ref } from 'vue';
import { mount } from '@vue/test-utils';
import VueDOMPurifyHTML from 'vue-dompurify-html';
import TextBubble from '../Index.vue';
import { provideMessageContext } from '../../../provider.js';

vi.mock('dashboard/composables/useUISettings', () => ({
  useUISettings: () => ({
    uiSettings: ref({
      gotchu_translate_on: false,
      gotchu_translate_target: 'de',
    }),
    updateUISettings: vi.fn(),
  }),
}));
vi.mock('dashboard/composables/useAccount', () => ({
  useAccount: () => ({ currentAccount: ref({ locale: 'en' }) }),
}));

const mountBubble = translations => {
  const Host = defineComponent({
    components: { TextBubble },
    setup() {
      provideMessageContext({
        content: ref('Where is my order?'),
        attachments: ref([]),
        contentAttributes: ref({ translations }),
        messageType: ref(0),
        variant: ref('user'),
      });
    },
    template: '<TextBubble />',
  });
  return mount(Host, {
    global: {
      plugins: [VueDOMPurifyHTML],
      mocks: { $t: key => key },
      stubs: { BaseBubble: { template: '<div><slot /></div>' } },
    },
  });
};

describe('Text bubble translation with the switch off', () => {
  it('still shows a stored translation for the own target, with the original toggle', () => {
    const wrapper = mountBubble({ de: 'Hallo' });
    expect(wrapper.text()).toContain('Hallo');
    expect(wrapper.text()).toContain('CONVERSATION.VIEW_ORIGINAL');
  });

  it('does not show a translation stored for another language', () => {
    const wrapper = mountBubble({ fr: 'Bonjour' });
    expect(wrapper.text()).toContain('Where is my order?');
    expect(wrapper.text()).not.toContain('Bonjour');
  });
});
