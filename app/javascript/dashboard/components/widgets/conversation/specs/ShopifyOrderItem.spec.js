import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ShopifyOrderItem from '../ShopifyOrderItem.vue';

// The order number is assembled by vue-i18n from `SHOPIFY.ORDER_ID`, so these
// assertions need the real message catalogue rather than the empty global i18n
// instance: under that one the keypath renders as its own key and the slot
// carrying the mono span never runs.
withFullI18n();

const order = {
  id: 5713,
  admin_url: 'https://example.myshopify.com/admin/orders/5713',
  created_at: '2026-03-12T12:00:00Z',
  total_price: '38.00',
  currency: 'EUR',
  financial_status: 'paid',
  fulfillment_status: 'fulfilled',
};

// `mount`, not `shallowMount`: an `<I18nT>` stub renders no slot, and the slot
// is where the mono span lives.
const mountComponent = (overrides = {}) =>
  mount(ShopifyOrderItem, { props: { order: { ...order, ...overrides } } });

// The icon spans and the chip share single classes with the meta line, so a
// match is on the whole set rather than on one name.
const findBySpanClasses = (wrapper, ...classNames) =>
  wrapper
    .findAll('span')
    .find(el => classNames.every(name => el.classes().includes(name)));

describe('ShopifyOrderItem', () => {
  // The mono order number is the context rail's most distinctive detail, and
  // nothing structural holds it in place: it hangs off an `I18nT` slot, so
  // simplifying that back to a plain `{{ }}` interpolation would drop it
  // silently. This is the assertion that objects.
  it('sets the order number, and only the number, in the mono face', () => {
    const wrapper = mountComponent();

    const mono = findBySpanClasses(
      wrapper,
      'font-[family-name:var(--g-font-mono)]'
    );

    expect(mono?.text()).toBe('5713');
    expect(wrapper.text()).toContain('Order #5713');
  });

  it('runs the paid date and the total together as one muted meta line', () => {
    const wrapper = mountComponent();

    const meta = findBySpanClasses(wrapper, 'text-xs', 'text-n-slate-11');

    expect(meta.text()).toContain('Paid Mar 12, 2026');
    expect(meta.text()).toContain('38.00');
    expect(meta.text()).toContain('·');
  });

  it('gives the fulfillment chip the agent tone', () => {
    const wrapper = mountComponent();

    const chip = findBySpanClasses(wrapper, 'text-[var(--g-agent)]');

    expect(chip.classes()).toContain('border-[var(--g-agent-border)]');
    expect(chip.text()).toBe('Fulfilled');
  });

  it('renders no fulfillment chip when the order has no fulfillment status', () => {
    const wrapper = mountComponent({ fulfillment_status: null });

    expect(findBySpanClasses(wrapper, 'text-[var(--g-agent)]')).toBeUndefined();
  });
});
