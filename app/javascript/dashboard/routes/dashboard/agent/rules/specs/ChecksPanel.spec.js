import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ChecksPanel from '../ChecksPanel.vue';

withFullI18n();

describe('ChecksPanel', () => {
  // The conditions check carries the parser's detail ("all.0.fact: unknown
  // fact"), which is for a log, not a supporter. The other checks' messages
  // are the spec's fixed sentences and pass through.
  it('words a failed conditions check, never the parser detail', () => {
    const wrapper = mount(ChecksPanel, {
      props: {
        checks: [
          {
            id: 'conditions',
            ok: false,
            message:
              'The conditions are not valid: all.0.fact: unknown fact "".',
          },
          { id: 'promise', ok: true, message: 'Promises nothing.' },
        ],
      },
    });
    expect(wrapper.find('[data-testid="check-conditions"]').text()).toBe(
      'A condition is not finished. Each one needs a fact and a value.'
    );
    expect(wrapper.text()).not.toContain('all.0.fact');
    expect(wrapper.text()).toContain('Promises nothing.');
  });
});
