import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import HandledLine from '../HandledLine.vue';

// The real catalogue, not `t: key => key`: both branches of this component are a
// catalogue string with an interpolation in it, so a key-returning mock would
// assert nothing about either.
withFullI18n();

const mountComponent = (props = {}) => mount(HandledLine, { props });

const dotOf = wrapper => wrapper.find('.handled-line__dot');

describe('HandledLine', () => {
  it('marks a Gotchu handover with the brand dot and no avatar', () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain('Handled by Gotchu');
    expect(dotOf(wrapper).exists()).toBe(true);
    // The once-per-screen accent, and the reason this is not `AgentDot`.
    expect(dotOf(wrapper).classes()).toContain('bg-[var(--g-brand)]');
    expect(wrapper.findComponent(Avatar).exists()).toBe(false);
  });

  it('marks a person with their avatar and no brand dot', () => {
    const wrapper = mountComponent({ by: 'Linh' });

    expect(wrapper.text()).toContain('Handled by Linh');
    expect(dotOf(wrapper).exists()).toBe(false);
    expect(wrapper.findComponent(Avatar).props('name')).toBe('Linh');
    expect(wrapper.findComponent(Avatar).props('size')).toBe(16);
  });

  it('says nothing about duration when there is none', () => {
    // Null is the absence of a handling time, not a zero. Rendering `· 0 min`
    // here would be a measurement nobody took.
    expect(mountComponent().text()).not.toContain('min');
    expect(mountComponent({ minutes: null }).text()).not.toContain('min');
  });

  it('renders a zero duration, which is a value and not an absence', () => {
    // The source tests `minutes != null`, so 0 is a real case: a conversation
    // closed inside the same minute it arrived.
    expect(mountComponent({ minutes: 0 }).text()).toContain(
      'Handled by Gotchu · 0 min'
    );
    expect(mountComponent({ by: 'Linh', minutes: 14 }).text()).toContain(
      'Handled by Linh · 14 min'
    );
  });

  it('pops only when asked to', () => {
    // A resolved list would otherwise overshoot every row on every render, and
    // the token sheet calls `--g-dur-pop` "the only overshoot".
    expect(dotOf(mountComponent()).classes()).not.toContain(
      'handled-line__dot--pop'
    );
    expect(dotOf(mountComponent({ pop: true })).classes()).toContain(
      'handled-line__dot--pop'
    );
  });
});
