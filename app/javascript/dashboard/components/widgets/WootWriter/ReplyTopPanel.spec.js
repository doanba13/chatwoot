import { mount } from '@vue/test-utils';
import { REPLY_EDITOR_MODES } from './constants';
import ReplyTopPanel from './ReplyTopPanel.vue';

vi.mock('dashboard/composables/useCaptain', () => ({
  useCaptain: () => ({ captainTasksEnabled: false }),
}));
vi.mock('dashboard/composables', () => ({ useTrack: vi.fn() }));
// The real composable binds through tinykeys after an async layout probe;
// capturing the bindings tests what each one does, not the key plumbing.
const keys = vi.hoisted(() => ({ events: null }));
vi.mock('dashboard/composables/useKeyboardEvents', () => ({
  useKeyboardEvents: events => {
    keys.events = events;
  },
}));

const mountPanel = props =>
  mount(ReplyTopPanel, {
    props: { composerTab: 'reply', ...props },
    global: { mocks: { $t: key => key } },
  });
const toggle = wrapper => wrapper.find('[data-testid="private-note-toggle"]');

describe('ReplyTopPanel private-note switch', () => {
  it('turns a reply into a note and a note back into a reply', async () => {
    const reply = mountPanel({ mode: REPLY_EDITOR_MODES.REPLY });
    await toggle(reply).trigger('click');
    expect(reply.emitted('setReplyMode')).toEqual([[REPLY_EDITOR_MODES.NOTE]]);
    const note = mountPanel({ mode: REPLY_EDITOR_MODES.NOTE });
    await toggle(note).trigger('click');
    expect(note.emitted('setReplyMode')).toEqual([[REPLY_EDITOR_MODES.REPLY]]);
  });

  it('stays on and locked where a public reply is restricted', async () => {
    const wrapper = mountPanel({
      mode: REPLY_EDITOR_MODES.REPLY,
      isReplyRestricted: true,
    });
    expect(toggle(wrapper).attributes('aria-checked')).toBe('true');
    expect(toggle(wrapper).attributes('disabled')).toBeDefined();
    await toggle(wrapper).trigger('click');
    expect(wrapper.emitted('setReplyMode')).toBeUndefined();
  });

  it('shows the switch only in the Reply tab', () => {
    expect(toggle(mountPanel({ composerTab: 'instruct' })).exists()).toBe(
      false
    );
    expect(toggle(mountPanel({ composerTab: 'memo' })).exists()).toBe(false);
  });

  it.each(['instruct', 'memo'])(
    'ignores Alt+P and Alt+L in the %s tab',
    tab => {
      const wrapper = mountPanel({
        composerTab: tab,
        mode: REPLY_EDITOR_MODES.REPLY,
      });
      keys.events['Alt+KeyP'].action();
      keys.events['Alt+KeyL'].action();
      expect(wrapper.emitted('setReplyMode')).toBeUndefined();
    }
  );

  it('still switches with Alt+P and Alt+L in the Reply tab', () => {
    const wrapper = mountPanel({ mode: REPLY_EDITOR_MODES.REPLY });
    keys.events['Alt+KeyP'].action();
    keys.events['Alt+KeyL'].action();
    expect(wrapper.emitted('setReplyMode')).toEqual([
      [REPLY_EDITOR_MODES.NOTE],
      [REPLY_EDITOR_MODES.REPLY],
    ]);
  });
});
