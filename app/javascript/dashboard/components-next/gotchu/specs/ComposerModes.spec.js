import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ComposerModes from '../ComposerModes.vue';

withFullI18n();
const radio = (w, m) => w.find(`[data-testid="composer-mode-${m}"]`);

describe('ComposerModes', () => {
  it('is a radio group with one checked mode', () => {
    const w = mount(ComposerModes, {
      props: { mode: 'reply', instructAvailable: true, hasDraft: true },
    });
    expect(w.find('[role="radiogroup"]').exists()).toBe(true);
    expect(radio(w, 'reply').attributes('aria-checked')).toBe('true');
    expect(radio(w, 'instruct').attributes('aria-checked')).toBe('false');
  });

  it('offers no Instruct when there is no draft', () => {
    const w = mount(ComposerModes, {
      props: { mode: 'reply', instructAvailable: false, hasDraft: false },
    });
    expect(radio(w, 'instruct').exists()).toBe(false);
    expect(radio(w, 'memo').exists()).toBe(true);
  });

  it.each([
    [
      { mode: 'instruct', hasDraft: true },
      'Nothing reaches the customer until you press Send.',
    ],
    [{ mode: 'reply', hasDraft: true }, 'set aside'],
    [
      { mode: 'reply', hasDraft: false },
      'Goes to the customer as you type it.',
    ],
    [
      { mode: 'reply', hasDraft: true, isNote: true },
      'Only your team sees this note.',
    ],
    [{ mode: 'memo', hasDraft: true }, 'Team only.'],
  ])('says what happens to the text: %j', (props, phrase) => {
    const w = mount(ComposerModes, {
      props: { instructAvailable: true, ...props },
    });
    expect(w.find('.mhint').text()).toContain(phrase);
  });

  it('emits the mode picked, and moves with the arrow keys', async () => {
    const w = mount(ComposerModes, {
      props: { mode: 'instruct', instructAvailable: true, hasDraft: true },
    });
    await radio(w, 'memo').trigger('click');
    await radio(w, 'instruct').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:mode')).toEqual([['memo'], ['reply']]);
  });

  it('wraps around at the ends and skips the missing Instruct', async () => {
    const w = mount(ComposerModes, {
      props: { mode: 'reply', instructAvailable: false, hasDraft: false },
    });
    await radio(w, 'reply').trigger('keydown', { key: 'ArrowLeft' });
    await radio(w, 'memo').trigger('keydown', { key: 'ArrowRight' });
    expect(w.emitted('update:mode')).toEqual([['memo'], ['reply']]);
  });

  it('keeps only the checked radio in the tab order', () => {
    const w = mount(ComposerModes, {
      props: { mode: 'memo', instructAvailable: true, hasDraft: true },
    });
    expect(radio(w, 'memo').attributes('tabindex')).toBe('0');
    expect(radio(w, 'reply').attributes('tabindex')).toBe('-1');
  });
});
