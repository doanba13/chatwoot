import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import ProcedureTiers from '../ProcedureTiers.vue';

vi.mock('dashboard/api/gotchu/procedures', () => ({
  default: { bindings: vi.fn(), setBinding: vi.fn() },
}));
withFullI18n();

const procedure = {
  id: 7,
  status: 'active',
  version: 4,
  holdSeconds: 60,
  autoSendEnabled: true,
  channels: {
    email: { autoPossible: true },
    messenger: { autoPossible: false },
    web: { autoPossible: false },
  },
};

describe('ProcedureTiers', () => {
  it('disables Auto on Messenger and says why, before anyone picks it', async () => {
    ProceduresAPI.bindings.mockResolvedValue({ data: { bindings: [] } });
    const wrapper = mount(ProcedureTiers, {
      props: { procedure, readOnly: false },
    });
    await flushPromises();
    expect(
      wrapper.find('[data-testid="tier-messenger-auto"]').attributes('disabled')
    ).toBeDefined();
    expect(wrapper.text()).toContain(
      'Auto is off here: this channel can’t prove whose order it is.'
    );
    expect(wrapper.text()).toContain('add the label gotchu-manual');
  });

  it('renders every button disabled for a reader who may not write', async () => {
    ProceduresAPI.bindings.mockResolvedValue({ data: { bindings: [] } });
    const wrapper = mount(ProcedureTiers, {
      props: { procedure, readOnly: true },
    });
    await flushPromises();
    const buttons = wrapper.findAll('button[data-testid^="tier-"]');
    expect(buttons).toHaveLength(12);
    expect(buttons.every(b => b.attributes('disabled') !== undefined)).toBe(
      true
    );
  });
});
