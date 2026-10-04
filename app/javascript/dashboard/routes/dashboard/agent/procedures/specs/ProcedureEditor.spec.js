import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import ProcedureEditor from '../ProcedureEditor.vue';

vi.mock('dashboard/api/gotchu/procedures', () => ({
  default: {
    show: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    replay: vi.fn(),
    replayLatest: vi.fn(),
    changeStatus: vi.fn(),
    revisions: vi.fn(),
    bindings: vi.fn(),
  },
}));
const role = vi.hoisted(() => ({ value: 'agent' }));
vi.mock('dashboard/api/gotchu/stores', () => ({
  default: {
    list: vi.fn().mockResolvedValue({
      data: { stores: [{ key: 'persoliebe', name: 'persoliebe' }] },
    }),
  },
}));
vi.mock('vue-router', async o => ({
  ...(await o()),
  useRoute: () => ({ params: {}, name: 'agent_procedure_new' }),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: name => (name === 'getCurrentRole' ? role : { value: [] }),
  useStore: () => ({ dispatch: vi.fn() }),
}));
withFullI18n();

describe('ProcedureEditor, a new procedure', () => {
  afterEach(() => {
    role.value = 'agent';
  });

  // Plan decision 1: procedure writes are administrators'. An agent who opens
  // the new-procedure URL gets the form read-only, as rules/new is, never an
  // editable form with no way to save it.
  it('renders read-only for an agent: no save, no phrase, fields disabled', async () => {
    const wrapper = mount(ProcedureEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="procedure-save"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="procedure-add-phrase"]').exists()).toBe(
      false
    );
    expect(
      wrapper
        .find('[data-testid="procedure-title"] input')
        .attributes('disabled')
    ).toBeDefined();
    expect(
      wrapper.find('[data-testid="procedure-store"]').attributes('disabled')
    ).toBeDefined();
    expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    expect(ProceduresAPI.create).not.toHaveBeenCalled();
  });

  it('stays editable for an administrator', async () => {
    role.value = 'administrator';
    const wrapper = mount(ProcedureEditor, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="procedure-save"]').exists()).toBe(true);
    expect(wrapper.find('textarea').attributes('disabled')).toBeUndefined();
  });
});
