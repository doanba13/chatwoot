import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Label from 'dashboard/components-next/label/Label.vue';
import Switch from 'dashboard/components-next/switch/Switch.vue';
import TopicSwitch from '../TopicSwitch.vue';

withFullI18n();

const topics = [
  { id: 'where', name: 'Where is my order', meta: 'Gotchu answers', on: true },
  { id: 'size', name: 'Wrong size', meta: 'Waits for you', on: false },
  // `null`, not falsy: this topic cannot be switched on at all.
  { id: 'refund', name: 'Refund', meta: 'Always a person', on: null },
];

const mountComponent = (props = {}) =>
  mount(TopicSwitch, { props: { topics, ...props } });

const rowsOf = wrapper => wrapper.findAll('.topic-switch__row');

describe('TopicSwitch', () => {
  it('renders a row per topic', () => {
    const text = mountComponent().text();

    expect(text).toContain('Where is my order');
    expect(text).toContain('Wrong size');
    expect(text).toContain('Refund');
  });

  it('gives a switchable topic a switch, on or off', () => {
    const switches = mountComponent().findAllComponents(Switch);

    // Two of the three: the `null` row is not switchable.
    expect(switches).toHaveLength(2);
    expect(switches.map(control => control.props('modelValue'))).toEqual([
      true,
      false,
    ]);
    // `agent`, so the on-state track is `--g-agent` rather than ink: teal means
    // Gotchu handles it end to end.
    switches.forEach(control => expect(control.props('agent')).toBe(true));
    expect(switches[0].attributes('aria-checked')).toBe('true');
    expect(switches[1].attributes('aria-checked')).toBe('false');
  });

  it('replaces the switch with a chip when the topic always hands over', () => {
    // `on === null` and not a falsy test: `false` is a switched-off topic and
    // must still render something movable.
    const wrapper = mountComponent();
    const chips = wrapper.findAllComponents(Label);

    expect(chips).toHaveLength(1);
    expect(chips[0].props('label')).toBe('Always hands over');
    expect(chips[0].props('color')).toBe('neutral');
    expect(chips[0].html()).toContain('i-lucide-users');
  });

  it('lets the caller name who it hands over to', () => {
    const wrapper = mountComponent({
      topics: [
        { id: 'refund', name: 'Refund', meta: '—', on: null, handler: 'Linh' },
      ],
    });

    expect(wrapper.findComponent(Label).props('label')).toBe('Linh');
    expect(wrapper.text()).not.toContain('Always hands over');
  });

  it('colours the meta line by whether Gotchu handles it', () => {
    const metaClasses = mountComponent()
      .findAll('.topic-switch__meta')
      .map(meta => meta.classes());

    expect(metaClasses[0]).toContain('text-[var(--g-agent)]');
    expect(metaClasses[1]).toContain('text-[var(--g-text-muted)]');
    // The always-hands-over row is muted too: a row that never reaches Gotchu is
    // not something Gotchu is doing.
    expect(metaClasses[2]).toContain('text-[var(--g-text-muted)]');
  });

  it('emits the topic and the NEW value, and does not move itself', async () => {
    // `Switch` uses `defineModel`, so passing `:model-value` without its update
    // listener would let it flip locally and report the value it just left. This
    // asserts both halves: the emitted value is the new one, and the rendered
    // switch has not moved — its state lives in the caller.
    const wrapper = mountComponent();
    const [on, off] = wrapper.findAllComponents(Switch);

    await on.trigger('click');
    await off.trigger('click');

    expect(wrapper.emitted('toggle')).toEqual([
      ['where', false],
      ['size', true],
    ]);
    expect(on.attributes('aria-checked')).toBe('true');
    expect(off.attributes('aria-checked')).toBe('false');
  });

  it('keeps every row at the minimum hit target', () => {
    // 44px, `--g-hit`, with `box-border` so the border on rows 2 and 3 comes out
    // of the height rather than adding to it.
    rowsOf(mountComponent()).forEach(row => {
      expect(row.classes()).toContain('min-h-[var(--g-hit)]');
      expect(row.classes()).toContain('box-border');
    });
  });

  it('draws a separator between rows but not above the first', () => {
    const rows = rowsOf(mountComponent());

    expect(rows[0].classes()).not.toContain('border-t');
    expect(rows[1].classes()).toContain('border-t');
    expect(rows[2].classes()).toContain('border-t');
  });
});
