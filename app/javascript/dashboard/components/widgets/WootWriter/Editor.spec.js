import { mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createStore } from 'vuex';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { withFullI18n } from 'test-i18n';
import Editor from './Editor.vue';
import {
  rememberInsertedDraft,
  insertedDraftFor,
  forgetInsertedDraft,
} from 'dashboard/components-next/gotchu/helpers/insertedDraft';

// This is the seam the Critical review finding lived in: BUS_EVENTS.
// INSERT_INTO_RICH_EDITOR has exactly one listener in production
// (useEmitter(BUS_EVENTS.INSERT_INTO_RICH_EDITOR, insertContentIntoEditor)
// below), and it is NOT in ReplyBox.vue. A synthetic, hand-registered
// listener standing in for that wiring is exactly what let the missing
// carrier through undetected the first time, so every test here mounts the
// real Editor.vue and drives its actual, registered funnels.
withFullI18n();

// jsdom has no layout, and ProseMirror measures the caret through Range rects
// (same polyfills as FullEditor.spec.js, which mounts a sibling editor built
// on the same @chatwoot/prosemirror-schema package).
const zeroRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0 };
Range.prototype.getClientRects = () => [zeroRect];
Range.prototype.getBoundingClientRect = () => zeroRect;
Element.prototype.scrollIntoView = () => {};

const buildStore = () =>
  createStore({
    getters: {
      getSelectedChat: () => ({ id: 4471 }),
      getUISettings: () => ({}),
      'draftMessages/get': () => () => '',
      'draftMessages/getReplyEditorMode': () => 'REPLY',
      'accounts/getUIFlags': () => ({}),
      'accounts/getAccount': () => () => ({ id: 1 }),
      'accounts/isFeatureEnabledonAccount': () => () => false,
      'globalConfig/get': () => ({}),
      'globalConfig/isOnChatwootCloud': () => false,
      'globalConfig/isMetaInboxCreationDisabled': () => false,
      'globalConfig/isMetaMessageSendingDisabled': () => false,
    },
  });

const buildRouter = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/accounts/:accountId/dummy', name: 'dummy', component: {} },
    ],
  });
  await router.push({ name: 'dummy', params: { accountId: '1' } });
  await router.isReady();
  return router;
};

const wrappers = [];

const mountEditor = async (props = {}) => {
  const router = await buildRouter();
  const wrapper = mount(Editor, {
    props: { conversationId: 4471, ...props },
    global: {
      plugins: [buildStore(), router],
      mocks: { $t: key => key },
    },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
};

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  forgetInsertedDraft(4471);
});

describe('Editor insert-to-send stamp (Critical finding regression)', () => {
  it('clears the stamp on the real BUS_EVENTS.INSERT_INTO_RICH_EDITOR listener', async () => {
    rememberInsertedDraft(4471, { cycleId: 1, draftVersion: 1 });

    await mountEditor();
    // The real registration this whole finding is about — not a hand-rolled
    // stand-in. If useEmitter(BUS_EVENTS.INSERT_INTO_RICH_EDITOR, ...) is
    // ever removed or rewired, this emit reaches nothing and the assertion
    // below fails.
    emitter.emit(BUS_EVENTS.INSERT_INTO_RICH_EDITOR, 'a Copilot suggestion');

    expect(insertedDraftFor(4471)).toBeNull();
  });

  it('clears the stamp when a canned response is inserted', async () => {
    rememberInsertedDraft(4471, { cycleId: 2, draftVersion: 3 });

    const wrapper = await mountEditor();
    // Drives the same function the real @replace handler calls
    // (`content => insertSpecialContent('cannedResponse', content)`,
    // Editor.vue's template) directly on the mounted instance, rather than a
    // re-implementation of it standing in for the wiring.
    //
    // getContentNode() (further down insertSpecialContent, unrelated to this
    // fix) needs the `range` the real slash-trigger flow computes while
    // typing, which this direct call does not simulate, so it throws once it
    // gets there. That is after the clear this test is about — the fix is
    // the first line of the function — so the throw is caught and ignored:
    // it is a fact about calling this function outside its normal trigger
    // sequence, not something this test needs to avoid.
    try {
      wrapper.vm.insertSpecialContent(
        'cannedResponse',
        'Hi, thanks for waiting'
      );
    } catch {
      // expected — see comment above.
    }

    expect(insertedDraftFor(4471)).toBeNull();
  });

  it('does not clear the stamp when a variable or an emoji is inserted', async () => {
    // Pins Ruling 14: getContentNode() resolves every one of these five
    // types through insertAtCursor's tr.replaceWith(from, to, node) over the
    // TYPED TRIGGER SPAN only (`{{`, `:`, …) — an in-place decoration that
    // cannot replace or constitute the draft the way a canned response's
    // templated body commonly does. A supporter dropping a merge field or an
    // emoji into the draft they are editing is the canonical edited send
    // this stamp exists to capture, so these two must leave it alone.
    rememberInsertedDraft(4471, { cycleId: 2, draftVersion: 3 });
    const wrapper = await mountEditor();

    ['variable', 'emoji'].forEach(type => {
      try {
        wrapper.vm.insertSpecialContent(type, 'placeholder');
      } catch {
        // Same incidental getContentNode()/range throw as the canned-response
        // test above — irrelevant to what this test checks.
      }
    });

    expect(insertedDraftFor(4471)).toEqual({ cycleId: 2, draftVersion: 3 });
  });

  it('leaves an unrelated conversation alone', async () => {
    rememberInsertedDraft(9999, { cycleId: 5, draftVersion: 1 });

    await mountEditor({ conversationId: 4471 });
    emitter.emit(BUS_EVENTS.INSERT_INTO_RICH_EDITOR, 'text for 4471');

    expect(insertedDraftFor(9999)).toEqual({ cycleId: 5, draftVersion: 1 });
  });
});
