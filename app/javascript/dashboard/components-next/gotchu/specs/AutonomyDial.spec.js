import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import RadioCard from 'dashboard/components-next/radioCard/RadioCard.vue';
import AutonomyDial from '../AutonomyDial.vue';

withFullI18n();

const mountComponent = (props = {}) => mount(AutonomyDial, { props });

describe('AutonomyDial', () => {
  it('offers three modes, each described by what the customer experiences', () => {
    const text = mountComponent().text();

    expect(text).toContain('Draft only');
    expect(text).toContain(
      'Customers hear from your team. Gotchu writes, you send.'
    );
    expect(text).toContain('Approve first');
    expect(text).toContain('Customers wait a few minutes.');
    expect(text).toContain('Handle selected topics');
    expect(text).toContain('Instant answers on the topics you switch on.');
  });

  it('is one radio group, not three', () => {
    // RadioCard defaults `name` to its own `id`, which would make each card an
    // independent group: nothing would deselect, and arrow keys would not move
    // between them.
    const wrapper = mountComponent();
    const names = wrapper
      .findAll('input')
      .map(input => input.attributes('name'));

    expect(names).toHaveLength(3);
    expect(new Set(names).size).toBe(1);
    expect(wrapper.attributes('role')).toBe('radiogroup');
  });

  it('keeps its ids to itself, so two dials can share a page', () => {
    // Two dials in ONE app, which is what the gallery does and what the dashboard
    // would do — `useId()` is unique per app, not globally, so two separate
    // `mount()` calls are two apps and would legitimately repeat. Six distinct
    // ids, because RadioCard puts its `id` on an input and its `for` on the label
    // around it, and three duplicated ids would make the second dial's labels
    // focus the first dial's inputs.
    const page = mount(
      {
        components: { AutonomyDial },
        template: '<div><AutonomyDial /><AutonomyDial /></div>',
      },
      {}
    );
    const ids = page.findAll('input').map(input => input.attributes('id'));

    expect(ids).toHaveLength(6);
    expect(new Set(ids).size).toBe(6);
    // And each dial is still its own radio group.
    const names = page.findAll('input').map(input => input.attributes('name'));
    expect(new Set(names).size).toBe(2);
  });

  it('selects the middle rung by default, and marks whatever it is told', () => {
    const cards = mountComponent().findAllComponents(RadioCard);
    expect(cards.map(card => card.props('isActive'))).toEqual([
      false,
      true,
      false,
    ]);

    const handling = mountComponent({ value: 'handle' });
    expect(
      handling.findAllComponents(RadioCard).map(card => card.props('isActive'))
    ).toEqual([false, false, true]);
  });

  it('emits the mode id rather than the scoped input id', async () => {
    const wrapper = mountComponent();

    await wrapper.findAll('input')[2].trigger('change');

    expect(wrapper.emitted('select')).toEqual([['handle']]);
  });

  it('locks the modes it is given, and tags them with the plan', () => {
    const wrapper = mountComponent({
      lockedIds: ['handle'],
      lockTag: 'Growth plan',
    });
    const cards = wrapper.findAllComponents(RadioCard);

    expect(cards.map(card => card.props('disabled'))).toEqual([
      false,
      false,
      true,
    ]);
    expect(wrapper.findAll('input')[2].attributes('disabled')).toBeDefined();
    expect(wrapper.text()).toContain('Growth plan');
    // The tag renders only on the locked card, which is RadioCard's own rule.
    expect(wrapper.text().match(/Growth plan/g)).toHaveLength(1);
  });

  it('emits nothing from a locked mode', async () => {
    const wrapper = mountComponent({ lockedIds: ['draft', 'handle'] });

    await wrapper.findAll('input')[0].trigger('change');
    await wrapper.findAll('input')[2].trigger('change');

    expect(wrapper.emitted('select')).toBeUndefined();
  });

  it('still describes a locked mode rather than replacing the sentence', () => {
    // RadioCard swaps `description` for `disabledMessage` when it has one. This
    // dial passes none, so the customer-facing sentence survives being locked —
    // which is the point of the copy: you should be able to read what you are
    // not allowed to pick.
    expect(mountComponent({ lockedIds: ['handle'] }).text()).toContain(
      'Instant answers on the topics you switch on.'
    );
  });
});
