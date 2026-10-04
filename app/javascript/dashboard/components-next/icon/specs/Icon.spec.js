import { h } from 'vue';
import { mount } from '@vue/test-utils';
import Icon from '../Icon.vue';

describe('Icon', () => {
  it('renders a function icon as a component, never as its source text', () => {
    const wrapper = mount(Icon, {
      props: { icon: () => h('span', { class: 'drawn-dot' }) },
    });

    expect(wrapper.find('span.drawn-dot').exists()).toBe(true);
    expect(wrapper.text()).not.toContain('=>');
  });

  it('still renders a class string as a span', () => {
    const wrapper = mount(Icon, { props: { icon: 'i-lucide-mail' } });

    expect(wrapper.find('span.i-lucide-mail').exists()).toBe(true);
  });
});
