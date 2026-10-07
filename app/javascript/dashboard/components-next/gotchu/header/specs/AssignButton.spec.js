import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import { createStore } from 'vuex';
import { withFullI18n } from 'test-i18n';
import DropdownMenu from 'dashboard/components-next/dropdown-menu/DropdownMenu.vue';
import { useAgentsList } from 'dashboard/composables/useAgentsList';
import AssignButton from '../AssignButton.vue';

withFullI18n();

vi.mock('dashboard/composables/useAgentsList', () => ({
  useAgentsList: vi.fn(),
}));

const none = { id: 0, name: 'None', email: 'None' };
const anna = { id: 4, name: 'Anna', thumbnail: 'a.png' };
const bot = { id: 4, name: 'Triage bot', assignee_type: 'AgentBot' };

const mountWith = (list, assignee = null) => {
  useAgentsList.mockReturnValue({ agentsList: ref(list) });
  const actions = {
    setCurrentChatAssignee: vi.fn(),
    assignAgent: vi.fn(() => Promise.resolve()),
  };
  const store = createStore({ actions });
  const wrapper = mount(AssignButton, {
    props: { conversationId: 7, assignee },
    global: { plugins: [store] },
  });
  return { wrapper, actions };
};

const openMenu = async wrapper => {
  await wrapper.find('button').trigger('click');
  return wrapper.findComponent(DropdownMenu);
};

describe('AssignButton', () => {
  it('lists the inbox assignable agents, bots included, as the sidebar did', async () => {
    const { wrapper } = mountWith([anna, bot]);
    const menu = await openMenu(wrapper);
    expect(useAgentsList).toHaveBeenCalledWith(true, {
      includeAgentBots: true,
    });
    expect(menu.props('menuItems').map(i => i.label)).toEqual([
      'Anna',
      'Triage bot',
    ]);
  });

  it('assigns the picked agent with its own assignee type', async () => {
    const { wrapper, actions } = mountWith([anna, bot]);
    const menu = await openMenu(wrapper);
    menu.vm.$emit('action', menu.props('menuItems')[1]);
    expect(actions.assignAgent).toHaveBeenCalledWith(expect.anything(), {
      conversationId: 7,
      agentId: 4,
      assigneeType: 'AgentBot',
    });
  });

  it('unassigns on None', async () => {
    const { wrapper, actions } = mountWith([none, anna], anna);
    const menu = await openMenu(wrapper);
    menu.vm.$emit('action', menu.props('menuItems')[0]);
    expect(actions.setCurrentChatAssignee).toHaveBeenCalledWith(
      expect.anything(),
      { conversationId: 7, assignee: null, assigneeType: null }
    );
    expect(actions.assignAgent).toHaveBeenCalledWith(expect.anything(), {
      conversationId: 7,
      agentId: null,
      assigneeType: null,
    });
  });
});
