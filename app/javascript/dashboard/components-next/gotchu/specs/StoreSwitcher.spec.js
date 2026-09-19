import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import StoreSwitcher from '../StoreSwitcher.vue';

withFullI18n();

const stores = [
  { id: 'persoliebe', name: 'persoliebe', open: 12, color: '#6366f1' },
  {
    id: 'cadeauniq',
    name: 'cadeauniq',
    open: 4,
    persona: 'Camille',
    color: '#f97316',
  },
  // No colour: the store exists, the identity does not yet.
  { id: 'giftera', name: 'giftera', open: 0 },
];

const mountComponent = (props = {}) =>
  mount(StoreSwitcher, { props: { stores, ...props } });

describe('StoreSwitcher', () => {
  it('renders one row per store plus the cross-store row', () => {
    const wrapper = mountComponent();

    expect(wrapper.findAll('button')).toHaveLength(stores.length + 1);
    expect(wrapper.text()).toContain('persoliebe');
    expect(wrapper.text()).toContain('12 open');
    expect(wrapper.text()).toContain('4 open · persona: Camille');
    expect(wrapper.text()).toContain('All stores · Open');
  });

  it('shows a count of zero rather than hiding the row', () => {
    // A store with nothing open is still a store you can switch to, and an
    // absent row reads as an absent store.
    expect(mountComponent().text()).toContain('0 open');
  });

  it('gives the store colour to a dot, never to the avatar ground', () => {
    // DEPARTURE from the source's `Avatar kind: 'store'`. The token sheet's own
    // comment on these values is "8px dots and chips only, never a background".
    const wrapper = mountComponent();
    const avatars = wrapper.findAllComponents(Avatar);

    expect(avatars).toHaveLength(stores.length);
    avatars.forEach(avatar => {
      expect(avatar.props('size')).toBe(28);
      // Avatar's own ground is the tank, unchanged: the only thing this component
      // hands it is a name.
      expect(avatar.props('src')).toBe('');
      expect(avatar.html()).toContain('var(--g-surface-tank)');
    });

    const dots = wrapper.findAll('.store-switcher__dot');
    // Three stores, two colours: no colour renders no dot rather than a grey one,
    // which would read as a fifth store identity.
    expect(dots).toHaveLength(2);
    expect(dots.map(dot => dot.attributes('style'))).toEqual([
      'background: rgb(99, 102, 241);',
      'background: rgb(249, 115, 22);',
    ]);
    // 8px, which is the whole of the rule the mock broke.
    expect(dots[0].classes()).toContain('size-2');
  });

  it('marks the active row, including the cross-store one', () => {
    const active = mountComponent({ activeId: 'cadeauniq' });
    const rows = active.findAll('button');

    expect(rows[1].classes()).toContain('bg-[var(--g-surface-tank)]');
    expect(rows[0].classes()).toContain('bg-transparent');
    // The bottom row is selectable in its own right, not merely an action.
    expect(rows[3].classes()).toContain('bg-transparent');

    const all = mountComponent({ activeId: 'all' });
    expect(all.findAll('button')[3].classes()).toContain(
      'bg-[var(--g-surface-tank)]'
    );
  });

  it('emits the store id, and the literal `all` for the cross-store row', async () => {
    const wrapper = mountComponent();
    const rows = wrapper.findAll('button');

    await rows[0].trigger('click');
    await rows[3].trigger('click');

    expect(wrapper.emitted('select')).toEqual([['persoliebe'], ['all']]);
  });

  it('draws no keyboard hint unless the caller names a real binding', () => {
    // The source draws ⌘1…⌘4 unconditionally. Those bindings do not exist, and
    // ReplyTopPanel already settled this: name the real one, or draw none.
    expect(mountComponent().findAll('kbd')).toHaveLength(0);

    const hinted = mountComponent({
      stores: [{ ...stores[0], shortcut: 'Alt+1' }],
      allShortcut: 'Alt+0',
    });
    expect(hinted.findAll('kbd').map(key => key.text())).toEqual([
      'Alt+1',
      'Alt+0',
    ]);
  });
});
