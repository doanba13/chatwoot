import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Input from 'dashboard/components-next/input/Input.vue';
import DraftDock from '../DraftDock.vue';

// The real catalogue: the button labels are what tell the two send paths apart,
// and under `t: key => key` they would all read as keys.
withFullI18n();

const text = 'Ihre Sendung ist unterwegs.';

const mountComponent = (props = {}) =>
  mount(DraftDock, { props: { state: 'ready', text, ...props } });

const buttonLabelled = (wrapper, label) =>
  wrapper.findAll('button').find(button => button.text() === label);

const instructSubmit = wrapper =>
  wrapper.find('button[aria-label="Send instruction to Gotchu"]');

describe('DraftDock', () => {
  it('renders nothing at all in the none state', () => {
    const wrapper = mountComponent({ state: 'none' });

    // Vue leaves a `<!--v-if-->` placeholder, so assert on what an agent would
    // see rather than on the markup being byte-empty.
    expect(wrapper.find('div').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('offers exactly two paths out of a ready draft, plus discard', async () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain(text);

    await buttonLabelled(wrapper, 'Insert').trigger('click');
    await buttonLabelled(wrapper, 'Send draft').trigger('click');
    await buttonLabelled(wrapper, 'Discard').trigger('click');

    expect(wrapper.emitted('insert')).toHaveLength(1);
    expect(wrapper.emitted('send')).toHaveLength(1);
    expect(wrapper.emitted('discard')).toHaveLength(1);
  });

  it('hands an adjustment back verbatim, since it does not know what one means', async () => {
    const wrapper = mountComponent({ adjust: ['shorter', 'in French'] });

    await buttonLabelled(wrapper, 'in French').trigger('click');

    expect(wrapper.emitted('adjust')[0]).toEqual(['in French']);
  });

  it('renders no confidence chip when there is no level to render', () => {
    expect(mountComponent().text()).not.toContain('probably');
    expect(mountComponent({ confidence: 'probably' }).text()).toContain(
      'probably'
    );
  });

  it('routes a typed instruction to the agent and never to the customer', async () => {
    const wrapper = mountComponent();

    // The sentence a supporter is most likely to type is also the one the
    // deployed classifier gets wrong. Here it cannot be a send: there is no
    // path from the field to `send`, whatever the words are.
    await wrapper.find('input').setValue('send it');
    await instructSubmit(wrapper).trigger('click');

    expect(wrapper.emitted('instruct')[0]).toEqual(['send it']);
    expect(wrapper.emitted('send')).toBeUndefined();
    expect(wrapper.find('input').element.value).toBe('');
  });

  it('submits an instruction on enter as well as on the button', async () => {
    const wrapper = mountComponent();

    await wrapper.find('input').setValue('add the tracking number first');
    await wrapper.findComponent(Input).vm.$emit('enter');

    expect(wrapper.emitted('instruct')[0]).toEqual([
      'add the tracking number first',
    ]);
  });

  it('sends nothing for an instruction that is only whitespace', async () => {
    const wrapper = mountComponent();

    await wrapper.find('input').setValue('   ');

    expect(instructSubmit(wrapper).attributes('disabled')).toBeDefined();

    await instructSubmit(wrapper).trigger('click');

    expect(wrapper.emitted('instruct')).toBeUndefined();
  });

  it('offers no way to send a draft that is still arriving', async () => {
    const wrapper = mountComponent({
      state: 'streaming',
      streamingText: 'Reading the order…',
      confidence: 'probably',
    });

    expect(wrapper.text()).toContain('Reading the order…');
    expect(buttonLabelled(wrapper, 'Send draft')).toBeUndefined();
    expect(buttonLabelled(wrapper, 'Insert')).toBeUndefined();
    expect(wrapper.find('input').exists()).toBe(false);

    // Streaming and ready share a header, so the chip has a slot to appear in
    // before there is a draft to be confident about. It must not take it.
    expect(wrapper.text()).not.toContain('probably');

    await buttonLabelled(wrapper, 'stop and edit').trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });
});
