import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import DraftInstruct from '../DraftInstruct.vue';

withFullI18n();

const mountBox = (props = {}) =>
  mount(DraftInstruct, { props: { modelValue: '', ...props } });

describe('DraftInstruct', () => {
  it('is one plain three-row text box with no submit control of its own', () => {
    const wrapper = mountBox();
    const box = wrapper.find('textarea');

    expect(box.exists()).toBe(true);
    expect(box.attributes('rows')).toBe('3');
    expect(box.attributes('placeholder')).toBe('Tell Gotchu what to change…');
    // Redraft lives in the footer; an arrow here would be a second submit.
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('says plain words are enough under the box, or the notice it is handed', () => {
    expect(mountBox().find('.tbar').text()).toContain(
      'Plain words are enough.'
    );
    expect(
      mountBox({ message: 'Could not confirm.', tone: 'error' })
        .find('.tbar')
        .text()
    ).toBe('Could not confirm.');
  });

  it('emits update:modelValue as the supporter types', async () => {
    const wrapper = mountBox();
    await wrapper.find('textarea').setValue('kürzer bitte');
    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([
      'kürzer bitte',
    ]);
  });

  it.each([{ metaKey: true }, { ctrlKey: true }])(
    'submits on Mod+Enter (%o)',
    async modifier => {
      const wrapper = mountBox({ modelValue: 'kürzer bitte' });
      await wrapper
        .find('textarea')
        .trigger('keydown', { key: 'Enter', ...modifier });
      expect(wrapper.emitted('submit')).toHaveLength(1);
    }
  );

  it('keeps plain Enter a newline and emits nothing for it', async () => {
    const wrapper = mountBox({ modelValue: 'kürzer bitte' });
    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('submit')).toBeUndefined();
  });

  it('submits nothing that is only whitespace, or while busy', async () => {
    const blank = mountBox({ modelValue: '   ' });
    await blank
      .find('textarea')
      .trigger('keydown', { key: 'Enter', metaKey: true });
    expect(blank.emitted('submit')).toBeUndefined();

    const busy = mountBox({ modelValue: 'kürzer bitte', busy: true });
    expect(busy.find('textarea').attributes('disabled')).toBeDefined();
    await busy
      .find('textarea')
      .trigger('keydown', { key: 'Enter', metaKey: true });
    expect(busy.emitted('submit')).toBeUndefined();
  });

  it('caps the box at the length the server refuses past', () => {
    expect(
      mountBox({ maxLength: 2000 }).find('textarea').attributes('maxlength')
    ).toBe('2000');
  });
});
