import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ConfidenceChip from 'dashboard/components-next/gotchu/ConfidenceChip.vue';
import ApprovalCard from '../ApprovalCard.vue';

withFullI18n();

const base = {
  customer: 'Frau Weber',
  text: 'Ihre Sendung ist unterwegs und wurde zuletzt in Leipzig gescannt.',
};

const mountComponent = (props = {}) =>
  mount(ApprovalCard, { props: { ...base, ...props } });

const buttonLabelled = (wrapper, label) =>
  wrapper.findAll('button').find(button => button.text() === label);

describe('ApprovalCard', () => {
  it('renders the draft under the agent header', () => {
    const wrapper = mountComponent();

    expect(wrapper.text()).toContain('Needs your approval');
    expect(wrapper.text()).toContain('Frau Weber');
    expect(wrapper.text()).toContain('zuletzt in Leipzig gescannt');
  });

  it('renders no planned-actions section when there are none', () => {
    // An empty heading reads as "the actions failed to load", which is a
    // different claim from "this reply does nothing but reply".
    const wrapper = mountComponent();

    expect(wrapper.text()).not.toContain('Planned actions');
  });

  it('lists planned actions, and names an icon for every one', () => {
    const wrapper = mountComponent({
      actions: [
        { icon: 'i-lucide-truck', label: 'Re-check the tracking' },
        // The source's own vocabulary: a bare lucide name, no prefix.
        { icon: 'users', label: 'Tell Linh' },
        // No icon at all falls through to a check rather than dropping the row.
        { label: 'Mark the conversation pending' },
      ],
    });

    expect(wrapper.text()).toContain('Planned actions');
    expect(wrapper.text()).toContain('Re-check the tracking');
    expect(wrapper.html()).toContain('i-lucide-truck');
    expect(wrapper.html()).toContain('i-lucide-users');
    expect(wrapper.text()).toContain('Mark the conversation pending');
    expect(wrapper.html()).toContain('i-lucide-check');
  });

  it('renders the order id in the mono face, and no separator without one', () => {
    const withOrder = mountComponent({ orderId: '#PL-1095' });
    expect(withOrder.text()).toContain('#PL-1095');
    expect(withOrder.html()).toContain('font-[family-name:var(--g-font-mono)]');

    const withoutOrder = mountComponent();
    expect(withoutOrder.html()).not.toContain(
      'font-[family-name:var(--g-font-mono)]'
    );
  });

  it('renders no confidence chip by default', () => {
    // DEPARTURE from the source, which defaults this to `probably`.
    // `reply_draft.confidence` is null on every row, so a default would put a
    // measured-looking word on a card nothing measured.
    expect(mountComponent().findComponent(ConfidenceChip).exists()).toBe(false);

    const rated = mountComponent({ confidence: 'check' });
    expect(rated.findComponent(ConfidenceChip).props('level')).toBe('check');
    expect(rated.text()).toContain('check this');
  });

  it('gives Approve the one brand colour, and the other two slate', () => {
    // plan.md §2: brand marks approval and the handled moment, never a send.
    // `Button`'s colour enum has no `brand`, so this is the ResolveAction spelling.
    const approve = buttonLabelled(mountComponent(), 'Approve');

    expect(approve.classes()).toContain('!bg-n-axolotl');
    expect(buttonLabelled(mountComponent(), 'Adjust').classes()).not.toContain(
      '!bg-n-axolotl'
    );
    expect(
      buttonLabelled(mountComponent(), 'Hand over').classes()
    ).not.toContain('!bg-n-axolotl');
  });

  it('emits one event per way out, and nothing else', async () => {
    const wrapper = mountComponent();

    await buttonLabelled(wrapper, 'Approve').trigger('click');
    await buttonLabelled(wrapper, 'Adjust').trigger('click');
    await buttonLabelled(wrapper, 'Hand over').trigger('click');

    expect(wrapper.emitted('approve')).toHaveLength(1);
    expect(wrapper.emitted('adjust')).toHaveLength(1);
    expect(wrapper.emitted('handOver')).toHaveLength(1);
  });
});
