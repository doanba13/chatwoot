import { mount, flushPromises } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import MemosAPI from 'dashboard/api/gotchu/memos';
import MemoList from '../MemoList.vue';

vi.mock('dashboard/api/gotchu/memos', () => ({ default: { list: vi.fn() } }));
vi.mock('dashboard/composables/store', () => ({
  useMapGetter: name => ({
    value: name === 'getCurrentRole' ? 'administrator' : [],
  }),
  useStore: () => ({ dispatch: vi.fn() }),
}));
vi.mock('dashboard/api/gotchu/stores', () => ({
  default: {
    list: vi.fn().mockResolvedValue({ data: { stores: [], inboxes: [] } }),
  },
}));
withFullI18n();

describe('MemoList', () => {
  it('shows the unconfigured notice instead of an empty table', async () => {
    MemosAPI.list.mockResolvedValue({
      data: { memos: [], proposalsPending: 0, capabilities: { memos: false } },
    });
    const wrapper = mount(MemoList, {
      global: { stubs: { 'router-link': true } },
    });
    await flushPromises();
    expect(wrapper.find('[data-testid="agent-unconfigured"]').exists()).toBe(
      true
    );
    expect(wrapper.find('table').exists()).toBe(false);
  });
});
