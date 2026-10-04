import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ConditionRow from '../ConditionRow.vue';

withFullI18n();

const facts = [
  {
    name: 'line_item_text',
    ops: ['contains_any'],
    valueType: 'strings',
    origin: 'shopify',
  },
  {
    name: 'language',
    ops: ['in'],
    valueType: 'enum',
    values: ['de', 'fr', 'en'],
    origin: 'customer_text',
  },
];

const REASON =
  'Language comes from what the customer wrote, so it can only add text, never hold sending.';

const mountRow = (condition, sending = 'hand_over') =>
  mount(ConditionRow, {
    props: { facts, sending, modelValue: condition },
  });

// The recheck found this hint under an "Order contains" row, where it
// explained nothing. It is said where a disabled Language is in play: while a
// fact is still being picked, on a row that is itself Language, and on the
// disabled option.
describe('ConditionRow', () => {
  it('says nothing about Language under a row that is about something else', () => {
    const wrapper = mountRow({
      fact: 'line_item_text',
      op: 'contains_any',
      value: ['gravur'],
    });
    expect(wrapper.text()).not.toContain(REASON);
  });

  it('says why Language is disabled while a fact is still being picked', () => {
    const wrapper = mountRow({ fact: '', op: '', value: [] });
    expect(wrapper.text()).toContain(REASON);
  });

  it('says why on a Language row once sending is held', () => {
    const wrapper = mountRow({ fact: 'language', op: 'in', value: ['fr'] });
    expect(wrapper.text()).toContain(REASON);
  });

  it('puts the reason on the disabled option itself', () => {
    const wrapper = mountRow({
      fact: 'line_item_text',
      op: 'contains_any',
      value: ['gravur'],
    });
    const language = wrapper.find('option[value="language"]');
    expect(language.attributes('disabled')).toBeDefined();
    expect(language.attributes('title')).toBe(REASON);
  });

  it('says nothing while sending is No change, when Language is allowed', () => {
    const wrapper = mountRow({ fact: '', op: '', value: [] }, 'no_change');
    expect(wrapper.text()).not.toContain(REASON);
    expect(
      wrapper.find('option[value="language"]').attributes('title')
    ).toBeUndefined();
  });
});
