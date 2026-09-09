import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import AITrace from '../AITrace.vue';

// The real catalogue, not `t: key => key`: the summary line is a vue-i18n
// plural, so a key-returning mock would assert nothing about the one piece of
// logic this component has.
withFullI18n();

const steps = [
  { kind: 'order', did: 'Looked up #PL-1095', result: 'Paid, fulfilled' },
  {
    kind: 'fulfillment',
    did: 'Checked the tracking',
    result: 'Last scan Leipzig',
  },
  { kind: 'nothing-this-build-knows', did: 'Read the shipping policy' },
];

const mountComponent = (props = {}) => mount(AITrace, { props });

describe('AITrace', () => {
  it('counts what was checked, singular and plural', () => {
    expect(mountComponent({ steps }).text()).toContain(
      'Gotchu checked 3 things'
    );
    expect(mountComponent({ steps: [steps[0]] }).text()).toContain(
      'Gotchu checked 1 thing'
    );
  });

  it('names whoever did the checking', () => {
    expect(mountComponent({ steps, who: 'Linh' }).text()).toContain(
      'Linh checked 3 things'
    );
  });

  it('starts collapsed and reveals the steps in place', async () => {
    const wrapper = mountComponent({ steps });
    expect(wrapper.text()).not.toContain('Looked up #PL-1095');
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('false');

    await wrapper.find('button').trigger('click');

    expect(wrapper.text()).toContain('Looked up #PL-1095');
    expect(wrapper.text()).toContain('Last scan Leipzig');
    expect(wrapper.find('button').attributes('aria-expanded')).toBe('true');
  });

  it('renders a step whose kind it does not recognise', async () => {
    const wrapper = mountComponent({ steps, defaultOpen: true });

    // A kind with no icon falls through to a check rather than dropping the
    // step — a missing line reads as "Gotchu did not check that".
    expect(wrapper.text()).toContain('Read the shipping policy');
    expect(wrapper.html()).toContain('i-lucide-check');
  });

  it('does not open while the trace is still being produced', async () => {
    const wrapper = mountComponent({ steps, streaming: 'Reading the order…' });

    await wrapper.find('button').trigger('click');

    expect(wrapper.text()).toContain('Reading the order…');
    expect(wrapper.text()).not.toContain('Looked up #PL-1095');
    expect(wrapper.find('button').attributes('aria-expanded')).toBeUndefined();
  });
});
