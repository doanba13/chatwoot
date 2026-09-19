import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import EscalationCard from '../EscalationCard.vue';

withFullI18n();

const base = {
  to: 'Linh',
  reason: 'the customer asked for a refund in writing',
};

const mountComponent = (props = {}) =>
  mount(EscalationCard, { props: { ...base, ...props } });

describe('EscalationCard', () => {
  it('names who has it and why Gotchu stopped', () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain('Handed to Linh');
    expect(wrapper.text()).toContain('the customer asked for a refund');
    expect(wrapper.findComponent(Avatar).props('name')).toBe('Linh');
  });

  it('says what the customer was told, from the catalogue, when nothing is passed', () => {
    // The source ships this sentence as a prop default. It lives in the
    // catalogue instead so it can be translated — the desk reads it in German
    // and French — and the prop still overrides it.
    expect(mountComponent().text()).toContain(
      'Gotchu drafted nothing. Customer was told a person is on it.'
    );
  });

  it('lets the caller replace the note', () => {
    const wrapper = mountComponent({ note: 'Nobody has written back yet.' });

    expect(wrapper.text()).toContain('Nobody has written back yet.');
    expect(wrapper.text()).not.toContain('Gotchu drafted nothing');
  });

  it('draws no action unless one is named', () => {
    // A drawn control with nothing behind it is the failure DraftDock's
    // `writeEnabled` comment describes.
    expect(mountComponent().find('button').exists()).toBe(false);
  });

  it('emits the action once, when there is one', async () => {
    const wrapper = mountComponent({ actionLabel: 'Open the order' });

    expect(wrapper.find('button').text()).toBe('Open the order');
    await wrapper.find('button').trigger('click');

    expect(wrapper.emitted('action')).toHaveLength(1);
  });

  it('stays on the neutral border rather than danger', () => {
    // An escalation is the system working. A red card in a queue teaches the
    // desk to read every handover as a failure.
    const classes = mountComponent().classes().join(' ');

    expect(classes).toContain('border-[var(--g-border)]');
    expect(classes).not.toContain('danger');
  });
});
