import fs from 'node:fs';
import path from 'node:path';
import { flushPromises, mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import { emitter } from 'shared/helpers/mitt';
import { BUS_EVENTS } from 'shared/constants/busEvents';
import { INBOX_TYPES } from 'dashboard/helper/inbox';
import { DEFAULT_CONVERSATION_SIDEBAR_ITEMS_ORDER } from 'dashboard/composables/useUISettings';
import AiDraftAPI from 'dashboard/api/gotchu/aiDraft';
import DraftDockContainer from '../DraftDockContainer.vue';
import DraftInstruct from '../DraftInstruct.vue';
import {
  forgetInsertedDraft,
  insertedDraftFor,
  rememberInsertedDraft,
} from '../helpers/insertedDraft';

// The real catalogue. Every assertion in here is about which SENTENCE an agent
// reads, and under `t: key => key` a wrong mapping and a right one both pass.
withFullI18n();

vi.mock('dashboard/api/gotchu/aiDraft', () => ({
  default: { getDraft: vi.fn(), instruct: vi.fn() },
}));

const body = 'Ihre Sendung ist unterwegs und sollte in wenigen Tagen ankommen.';

const answer = (cycle, draft = null) => ({ data: { cycle, draft } });

// The same read, from a deployment that CAN forward an instruction. The
// capability is the server's answer about its own configuration, so it is part of
// the payload rather than a prop or a constant.
const answerWithInstruct = (cycle, draft = null) => ({
  data: { cycle, draft, capabilities: { instruct: true } },
});

const reviewing = (overrides = {}) => ({
  id: 2964,
  state: 'awaiting_review',
  storeKey: 'cadeauniq',
  expiresAt: null,
  ...overrides,
});

const httpError = status => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status };
  return error;
};

// A Rails refusal, which carries the `reason` the dock picks its sentence from.
const instructError = (status, reason) => {
  const error = new Error(`Request failed with status code ${status}`);
  error.response = { status, data: reason ? { reason } : {} };
  return error;
};

// Every mount is unmounted again. This component keeps an interval and a
// document-level `visibilitychange` listener, so a wrapper left mounted goes on
// reading in later tests — which is not a hypothetical: it is what made the
// hidden-tab test below count 25 reads instead of 2, one per leaked component.
const wrappers = [];

const create = (props = {}) => {
  const wrapper = mount(DraftDockContainer, {
    props: { conversationId: 3580, ...props },
  });
  wrappers.push(wrapper);
  return wrapper;
};

// A poll is the only way this surface learns anything, so nearly every test here
// needs to move the clock. Real timers would make them sleep.
const mountContainer = async (props = {}) => {
  const wrapper = create(props);
  await flushPromises();
  return wrapper;
};

// The band itself, rather than the component that may be rendering nothing:
// `DraftDock` is always mounted here and draws nothing at `state: 'none'`, so
// `findComponent` cannot tell a dock from an empty composer.
const dock = wrapper => wrapper.find('.draft-dock');

let hidden = false;

beforeEach(() => {
  hidden = false;
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: () => hidden,
  });
  AiDraftAPI.getDraft.mockResolvedValue(answer(null));
  AiDraftAPI.instruct.mockResolvedValue({ data: { status: 'accepted' } });
});

afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount());
  vi.useRealTimers();
  // insertedDraft.js is a module-level Map, not component state, so it
  // outlives the wrapper it was written by. Every test in this file mounts
  // with the same default conversationId (3580), and the insert tests below
  // genuinely call onInsert — so without this, a leftover stamp from one
  // test is exactly the kind of thing the next test's assertions would trip
  // over without ever touching insertedDraft.js itself.
  forgetInsertedDraft(3580);
});

describe('DraftDockContainer', () => {
  it('reads the draft for the conversation it was opened on', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );

    const wrapper = await mountContainer({ conversationId: 3580 });

    expect(AiDraftAPI.getDraft).toHaveBeenCalledWith(3580);
    expect(wrapper.text()).toContain(body);
  });

  it('adds nothing to the composer while the first read is in flight', async () => {
    // The panel put a spinner here, because a sidebar section is always present
    // and had to say something. Above the editor it must not: this mounts on
    // every conversation the agent opens, nearly all of which never had a draft,
    // and a band that flickers in and out on every open is the noise this
    // placement exists to avoid.
    let resolve;
    AiDraftAPI.getDraft.mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );

    const wrapper = create();

    expect(wrapper.text()).toBe('');
    expect(wrapper.find('svg.animate-spin').exists()).toBe(false);

    resolve(answer(reviewing(), { version: 1, body }));
    await flushPromises();

    expect(wrapper.text()).toContain(body);
  });

  it('keeps the dock separated from the editor under it', async () => {
    // The dock draws its own bottom border and that is what it was drawn for —
    // it is the line between the band and the editor. The panel wrapper used to
    // null it, because AccordionItem drew one of its own; nothing does now, and
    // nothing should.
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );

    expect(dock(await mountContainer()).classes()).toContain('border-b');
  });
});

describe('DraftDockContainer cycle state mapping', () => {
  it('shows an awaiting_review draft as ready to review', async () => {
    const wrapper = await mountContainer();
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(
        reviewing({
          expiresAt: new Date(Date.now() + 18.5 * 60_000).toISOString(),
        }),
        {
          version: 2,
          body,
        }
      )
    );
    await wrapper.setProps({ conversationId: 3577 });
    await flushPromises();

    expect(wrapper.text()).toContain(body);
    expect(wrapper.text()).toContain('Draft from Gotchu');
    // The review window goes straight through to the countdown the dock already
    // renders, and renders nothing when the cycle carries no expiry.
    expect(wrapper.text()).toContain('18 min to review');
  });

  it('renders no review window when the cycle carries no expiry', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing({ expiresAt: null }), { version: 1, body })
    );

    const wrapper = await mountContainer();

    expect(wrapper.text()).toContain(body);
    expect(wrapper.text()).not.toContain('to review');
  });

  it('shows the highest version the gateway handed back', async () => {
    // The gateway already picks the highest version rather than the last row; all
    // this asserts is that the body is taken from `draft` and not from anywhere
    // else. A draft shown at a version nobody approved is invariant 6's failure.
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 3, body: 'v3 body' })
    );

    expect((await mountContainer()).text()).toContain('v3 body');
  });

  it('shows redrafting as a draft on its way, not as a draft', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing({ state: 'redrafting' }), { version: 1, body })
    );

    const wrapper = await mountContainer();

    // The one honest use of the dock's streaming state: something really is being
    // written. The wording says a draft is being written, not that text is
    // arriving character by character — there is no push from the worker.
    expect(wrapper.text()).toContain('Writing a new draft…');
    // And the previous version is not on screen, because it is not what the
    // supporter asked for any more.
    expect(wrapper.text()).not.toContain(body);
    expect(wrapper.text()).not.toContain('Insert');
  });

  const latest = { version: 1, body };

  it.each([
    { name: 'no cycle at all', cycle: null, draft: null },
    {
      name: 'an expired cycle',
      cycle: reviewing({ state: 'expired' }),
      draft: latest,
    },
    {
      name: 'a sent cycle',
      cycle: reviewing({ state: 'sent' }),
      draft: latest,
    },
    {
      name: 'a superseded cycle',
      cycle: reviewing({ state: 'superseded' }),
      draft: latest,
    },
    {
      name: 'a held cycle',
      cycle: reviewing({ state: 'held' }),
      draft: latest,
    },
    { name: 'a cycle with no body yet', cycle: reviewing(), draft: null },
    {
      name: 'a state this build does not know',
      cycle: reviewing({ state: 'something_new' }),
      draft: latest,
    },
  ])('adds nothing to the composer for $name', async ({ cycle, draft }) => {
    // "Streaming, then ready, then gone": there is no empty state above the
    // editor, because most conversations in the inbox never had a draft and a
    // permanent "no draft" band on every one of them is noise. The panel said
    // which kind of empty this was; that reading is gone with the panel, and the
    // mapping in draftView.js is where the distinction survives.
    AiDraftAPI.getDraft.mockResolvedValue(answer(cycle, draft));

    const wrapper = await mountContainer();

    expect(wrapper.text()).toBe('');
    expect(dock(wrapper).exists()).toBe(false);
  });

  it.each(['expired', 'sent', 'superseded', 'held', 'something_new'])(
    'never shows the body of a %s cycle as up for review',
    async state => {
      // A finished cycle still has a latest draft, and showing it above the editor
      // as though it were waiting for review is the one genuinely wrong answer
      // this surface can give: Insert is one press away from sending it twice.
      AiDraftAPI.getDraft.mockResolvedValue(
        answer(reviewing({ state }), { version: 1, body })
      );

      expect((await mountContainer()).text()).not.toContain(body);
    }
  );
});

describe('DraftDockContainer failure modes', () => {
  // The one thing that must NOT render as silence. A dead gateway and an
  // unconfigured one are indistinguishable from "no draft" if they show nothing,
  // which is the mistake the panel makes when it renders a blank for a PII-denied
  // Shopify field: a blank reads as "there is nothing here" and sends an agent
  // hunting a bug that does not exist.
  it('says a dead gateway and an unconfigured one in different words', async () => {
    AiDraftAPI.getDraft.mockRejectedValue(httpError(502));
    const dead = await mountContainer();

    AiDraftAPI.getDraft.mockRejectedValue(httpError(503));
    const unset = await mountContainer();

    expect(dead.text()).toContain('Gotchu is not answering');
    expect(unset.text()).toContain('not configured on this Chatwoot');
    expect(dead.text()).not.toBe(unset.text());
  });

  it.each([
    [502, 'Gotchu is not answering'],
    [503, 'Gotchu is not configured on this Chatwoot'],
  ])('never reads a %s as an empty composer', async (status, sentence) => {
    AiDraftAPI.getDraft.mockRejectedValue(httpError(status));

    const wrapper = await mountContainer();

    expect(wrapper.text()).toContain(sentence);
    // And it is a line, not a band: no draft to insert, so no dock and no
    // buttons above the editor.
    expect(dock(wrapper).exists()).toBe(false);
    expect(wrapper.findAll('button')).toHaveLength(0);
  });

  it('says a transport failure with no status is a fault too', async () => {
    AiDraftAPI.getDraft.mockRejectedValue(new Error('Network Error'));

    expect((await mountContainer()).text()).toContain('could not be read');
  });

  it('treats a 200 that is not the contract as a fault, not as an empty draft', async () => {
    AiDraftAPI.getDraft.mockResolvedValue({ data: 'not an object' });

    expect((await mountContainer()).text()).toContain('could not be read');
  });

  it('says it muted rather than as an alarm', async () => {
    // It sits above the editor on every conversation for as long as the fault
    // lasts. An alarm an agent sits beside all shift is tuned out within a day,
    // and this one is not theirs to act on.
    AiDraftAPI.getDraft.mockRejectedValue(httpError(502));

    const notice = (await mountContainer()).find('p');

    expect(notice.classes()).toContain('text-[var(--g-text-muted)]');
    expect(notice.classes()).not.toContain('text-[var(--g-danger-text)]');
  });
});

describe('DraftDockContainer on a conversation change', () => {
  it('reads again for the new conversation', async () => {
    const wrapper = await mountContainer({ conversationId: 3580 });
    expect(AiDraftAPI.getDraft).toHaveBeenLastCalledWith(3580);

    await wrapper.setProps({ conversationId: 3577 });
    await flushPromises();

    expect(AiDraftAPI.getDraft).toHaveBeenLastCalledWith(3577);
  });

  it('clears the previous conversation draft before the new read lands', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );
    const wrapper = await mountContainer({ conversationId: 3580 });
    expect(wrapper.text()).toContain(body);

    let resolve;
    AiDraftAPI.getDraft.mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );
    await wrapper.setProps({ conversationId: 3577 });

    // The worst failure this surface has: one customer's reply sitting above the
    // editor of another customer's conversation, one Insert away from going out.
    expect(wrapper.text()).not.toContain(body);

    resolve(answer(null));
    await flushPromises();
  });

  it('drops an answer that arrives for the conversation the agent left', async () => {
    let resolveFirst;
    AiDraftAPI.getDraft.mockReturnValueOnce(
      new Promise(r => {
        resolveFirst = r;
      })
    );
    const wrapper = create();

    AiDraftAPI.getDraft.mockResolvedValue(answer(null));
    await wrapper.setProps({ conversationId: 3577 });
    await flushPromises();

    // An agent clicking down a list switches faster than a round trip completes.
    resolveFirst(answer(reviewing(), { version: 1, body: 'stale draft' }));
    await flushPromises();

    expect(wrapper.text()).toBe('');
  });

  it('drops a FAILED read that arrives for the conversation the agent left', async () => {
    // The notice is the one thing this surface renders unasked, so a stale
    // failure must not land on a conversation that has since read cleanly.
    let rejectFirst;
    AiDraftAPI.getDraft.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFirst = reject;
      })
    );
    const wrapper = create();

    AiDraftAPI.getDraft.mockResolvedValue(answer(null));
    await wrapper.setProps({ conversationId: 3577 });
    await flushPromises();

    rejectFirst(httpError(502));
    await flushPromises();

    expect(wrapper.text()).toBe('');
  });
});

describe('DraftDockContainer polling', () => {
  it('picks up a draft that lands after the conversation was opened', async () => {
    vi.useFakeTimers();
    AiDraftAPI.getDraft.mockResolvedValue(answer(null));

    const wrapper = create();
    await flushPromises();
    expect(wrapper.text()).toBe('');

    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );
    await vi.advanceTimersByTimeAsync(15_000);
    await flushPromises();

    expect(wrapper.text()).toContain(body);
  });

  it('stops polling when the composer goes away', async () => {
    // Which is also how "do not poll a conversation nobody is looking at" is
    // enforced: `ConversationBox` renders the whole messages view behind
    // `v-if="currentChat.id"`, so leaving unmounts this. There is no flag to
    // forget to check.
    vi.useFakeTimers();
    const wrapper = create();
    await flushPromises();
    const readsWhileOpen = AiDraftAPI.getDraft.mock.calls.length;

    wrapper.unmount();
    await vi.advanceTimersByTimeAsync(15_000 * 4);

    expect(AiDraftAPI.getDraft).toHaveBeenCalledTimes(readsWhileOpen);
  });

  it('does not poll a browser tab nobody is looking at', async () => {
    vi.useFakeTimers();
    create();
    await flushPromises();
    const before = AiDraftAPI.getDraft.mock.calls.length;

    hidden = true;
    await vi.advanceTimersByTimeAsync(15_000 * 3);
    expect(AiDraftAPI.getDraft).toHaveBeenCalledTimes(before);

    // And reads straight away on the way back rather than waiting out the rest of
    // the interval — coming back is exactly when the agent looks.
    hidden = false;
    document.dispatchEvent(new Event('visibilitychange'));
    await flushPromises();
    expect(AiDraftAPI.getDraft.mock.calls.length).toBe(before + 1);
  });

  it('does not stack reads up behind a gateway slower than the interval', async () => {
    vi.useFakeTimers();
    let resolve;
    AiDraftAPI.getDraft.mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );

    create();
    await vi.advanceTimersByTimeAsync(15_000 * 3);

    // One read outstanding, three ticks passed. A gateway having a bad minute
    // must not be handed four times the load for it.
    expect(AiDraftAPI.getDraft).toHaveBeenCalledTimes(1);

    resolve(answer(null));
    await flushPromises();
  });
});

describe('DraftDockContainer insert', () => {
  beforeEach(() => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );
  });

  it('puts the draft into the rich editor on an email conversation', async () => {
    const emit = vi.spyOn(emitter, 'emit');
    const wrapper = await mountContainer({ channelType: INBOX_TYPES.EMAIL });

    await wrapper.find('button').trigger('click');

    // The editor listens for this; nothing here touches the DOM. A draft is
    // inserted the way a canned response or a Copilot suggestion is.
    expect(emit).toHaveBeenCalledWith(BUS_EVENTS.INSERT_INTO_RICH_EDITOR, body);
  });

  it('puts it into the plain editor everywhere else', async () => {
    const emit = vi.spyOn(emitter, 'emit');
    const wrapper = await mountContainer({ channelType: INBOX_TYPES.FB });

    await wrapper.find('button').trigger('click');

    expect(emit).toHaveBeenCalledWith(
      BUS_EVENTS.INSERT_INTO_NORMAL_EDITOR,
      body
    );
  });

  it('inserts nothing when there is nothing to insert', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(answer(null));
    const emit = vi.spyOn(emitter, 'emit');

    await mountContainer();

    expect(emit).not.toHaveBeenCalled();
  });
});

// The provenance stamp Insert hands to Send (content_attributes.gotchu),
// tracked in ../helpers/insertedDraft.js. DraftDockContainer only ever
// WRITES to it (on Insert) and CLEARS it (on a poll that moved on) — the
// funnels that clear it on a different insert live in Editor.vue and
// ReplyBox.vue, covered in their own specs.
describe('DraftDockContainer gotchu stamp', () => {
  beforeEach(() => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );
  });

  afterEach(() => {
    forgetInsertedDraft(9001);
  });

  it('records the cycle and version on Insert, scoped to this conversation', async () => {
    const wrapper = await mountContainer({ conversationId: 3580 });

    await wrapper.find('button').trigger('click');

    expect(insertedDraftFor(3580)).toEqual({ cycleId: 2964, draftVersion: 1 });
    // A supporter with a second conversation open must not have this one's
    // Insert stamp it too.
    expect(insertedDraftFor(9001)).toBeNull();
  });

  it("leaves another conversation's remembered draft untouched", async () => {
    rememberInsertedDraft(9001, { cycleId: 1, draftVersion: 1 });

    const wrapper = await mountContainer({ conversationId: 3580 });
    await wrapper.find('button').trigger('click');

    expect(insertedDraftFor(9001)).toEqual({ cycleId: 1, draftVersion: 1 });
  });

  it('records after the insert event fires, not before — swapping emit and remember breaks this', async () => {
    // Shaped after the REAL clearing funnels (Editor.vue's
    // insertContentIntoEditor, ReplyBox's addIntoEditor): clear on every
    // insert, unconditionally. Registered on the actual bus event so this
    // test is sensitive to the order onInsert does its two jobs in, not to
    // how the fake listener happens to be written.
    const clearOnInsert = () => forgetInsertedDraft(3580);
    emitter.on(BUS_EVENTS.INSERT_INTO_NORMAL_EDITOR, clearOnInsert);
    try {
      const wrapper = await mountContainer({ conversationId: 3580 });
      await wrapper.find('button').trigger('click');

      // If onInsert ever remembers BEFORE it emits, clearOnInsert above wipes
      // the write out and this reads null instead.
      expect(insertedDraftFor(3580)).toEqual({
        cycleId: 2964,
        draftVersion: 1,
      });
    } finally {
      emitter.off(BUS_EVENTS.INSERT_INTO_NORMAL_EDITOR, clearOnInsert);
    }
  });

  it('clears the memory when a later poll shows a different draft version', async () => {
    vi.useFakeTimers();
    const wrapper = await mountContainer({ conversationId: 3580 });
    await wrapper.find('button').trigger('click');
    expect(insertedDraftFor(3580)).toEqual({ cycleId: 2964, draftVersion: 1 });

    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 2, body: 'a redraft' })
    );
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();
    await flushPromises();

    expect(insertedDraftFor(3580)).toBeNull();
  });

  it('clears the memory when a later poll shows a different cycle', async () => {
    // Same version number, different cycle: a version-only comparison would
    // read this as unchanged, but it is a different draft entirely — a new
    // cycle's own version numbering starts at 1 again.
    vi.useFakeTimers();
    const wrapper = await mountContainer({ conversationId: 3580 });
    await wrapper.find('button').trigger('click');
    expect(insertedDraftFor(3580)).toEqual({ cycleId: 2964, draftVersion: 1 });

    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing({ id: 3001 }), { version: 1, body: 'a new cycle' })
    );
    await vi.advanceTimersByTimeAsync(15_000);
    vi.useRealTimers();
    await flushPromises();

    expect(insertedDraftFor(3580)).toBeNull();
  });

  it('does not remember an incomplete stamp when the draft carries no valid version', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(answer(reviewing(), { body }));

    const wrapper = await mountContainer({ conversationId: 3580 });
    await wrapper.find('button').trigger('click');

    // Text still goes to the editor either way (asserted in the insert
    // block above); what must not happen is a stamp missing draftVersion.
    expect(insertedDraftFor(3580)).toBeNull();
  });
});

describe('DraftDockContainer write surface', () => {
  beforeEach(() => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );
  });

  it('offers Insert and nothing else while the write routes are dark', async () => {
    const wrapper = await mountContainer();
    const labels = wrapper.findAll('button').map(button => button.text());

    // Not disabled — absent. The gateway's write routes are unreachable
    // (`GESTURE_SURFACE` unset) and their authorization is not built, so every
    // one of these would be a press that silently did nothing, which an agent
    // reads as "the reply went out".
    expect(labels).toEqual(['Insert']);
    expect(wrapper.text()).not.toContain('Send draft');
    expect(wrapper.text()).not.toContain('Discard');
    expect(wrapper.find('input').exists()).toBe(false);
  });

  it('offers no adjustments either, whatever it is handed', async () => {
    const wrapper = await mountContainer();

    expect(wrapper.text()).not.toContain('Adjust:');
  });
});

describe('DraftDockContainer instruct', () => {
  const field = wrapper => wrapper.findComponent(DraftInstruct);
  const input = wrapper => field(wrapper).find('input');
  const arrow = wrapper => field(wrapper).find('button');

  const readyToInstruct = async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answerWithInstruct(reviewing(), { version: 2, body })
    );
    return mountContainer({ conversationId: 3580 });
  };

  // Type and press, as an agent does. Both halves matter: `setValue` is what
  // makes the container's copy of the text real, and the arrow is the gesture.
  const instruct = async (wrapper, text) => {
    await input(wrapper).setValue(text);
    await arrow(wrapper).trigger('click');
    await flushPromises();
  };

  const lastRequestId = () =>
    AiDraftAPI.instruct.mock.calls.at(-1)[1].requestId;

  it('offers no instruction field until the server says it can forward one', async () => {
    // Not disabled — absent, for the same reason the customer-facing gestures
    // are. A field that silently fails is read as the agent ignoring the
    // instruction.
    AiDraftAPI.getDraft.mockResolvedValue(
      answer(reviewing(), { version: 1, body })
    );

    const wrapper = await mountContainer();

    // The draft itself IS on screen — this is a ready cycle with a body, so the
    // only thing keeping the field away is the missing capability.
    expect(wrapper.text()).toContain(body);
    expect(field(wrapper).exists()).toBe(false);
  });

  it('offers the field once the server reports the capability', async () => {
    const wrapper = await readyToInstruct();

    expect(field(wrapper).exists()).toBe(true);
    expect(input(wrapper).attributes('placeholder')).toBe(
      'Tell Gotchu what to change…'
    );
    // The same cap Rails refuses on, so the browser cannot produce a 422 by
    // typing.
    expect(input(wrapper).attributes('maxlength')).toBe('2000');
  });

  it('opens no other gesture with it', async () => {
    // The capability is instruct and only instruct. A send reaches a customer.
    const wrapper = await readyToInstruct();
    const labels = wrapper.findAll('button').map(button => button.text());

    expect(labels).toEqual(['Insert', '']);
    expect(wrapper.text()).not.toContain('Send draft');
    expect(wrapper.text()).not.toContain('Discard');
  });

  it('offers nothing to instruct while a draft is still being written', async () => {
    AiDraftAPI.getDraft.mockResolvedValue(
      answerWithInstruct(reviewing({ state: 'redrafting' }))
    );

    const wrapper = await mountContainer();

    expect(field(wrapper).exists()).toBe(false);
  });

  it('forwards the typed instruction against the cycle on screen', async () => {
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'Bitte die Sendungsnummer zuerst nennen.');

    expect(AiDraftAPI.instruct).toHaveBeenCalledWith(3580, {
      text: 'Bitte die Sendungsnummer zuerst nennen.',
      cycleId: 2964,
      requestId: expect.any(String),
    });
  });

  it('sends a token the gateway will accept', async () => {
    // 8-128 characters of A-Za-z0-9_- and no colon. The gateway derives its
    // idempotency key from this, so a token it refuses is a press that 400s.
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');

    expect(lastRequestId()).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });

  it('mints a token a browser with no crypto.randomUUID can still use', async () => {
    // A self-hosted Chatwoot on plain HTTP is not a secure context, and
    // `crypto.randomUUID` does not exist there. The token has to stay inside the
    // gateway's format anyway: it derives its idempotency key from it.
    Object.defineProperty(globalThis.crypto, 'randomUUID', {
      value: undefined,
      configurable: true,
    });
    try {
      const wrapper = await readyToInstruct();

      await instruct(wrapper, 'kürzer bitte');

      expect(lastRequestId()).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
    } finally {
      delete globalThis.crypto.randomUUID;
    }
  });

  it('sends nothing for an instruction that is only whitespace', async () => {
    const wrapper = await readyToInstruct();

    await input(wrapper).setValue('   ');

    expect(arrow(wrapper).attributes('disabled')).toBeDefined();

    await arrow(wrapper).trigger('click');
    await flushPromises();

    expect(AiDraftAPI.instruct).not.toHaveBeenCalled();
  });

  it('locks the field while the instruction is in flight', async () => {
    // Every press is an instruction. Two instructions out of one thought is the
    // thing this prevents, and it is the only protection against it that does not
    // depend on the supporter noticing.
    let resolve;
    AiDraftAPI.instruct.mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );
    const wrapper = await readyToInstruct();

    await input(wrapper).setValue('warmer schreiben');
    await arrow(wrapper).trigger('click');
    await flushPromises();

    expect(input(wrapper).attributes('disabled')).toBeDefined();
    expect(arrow(wrapper).attributes('disabled')).toBeDefined();

    resolve({ data: { status: 'accepted' } });
    await flushPromises();

    expect(input(wrapper).attributes('disabled')).toBeUndefined();
  });

  it('says the instruction was accepted, and nothing about what it did', async () => {
    // Acceptance is the last thing this browser observes: the agent answers as
    // a private note in the conversation, and whether it understood the instruction never comes back
    // here. A "done" would be a claim about something nobody watched.
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');

    expect(wrapper.text()).toContain('Instruction accepted');
    expect(wrapper.text()).toContain('private note in this conversation');
    expect(wrapper.text()).not.toContain('Lark');
    expect(wrapper.text()).not.toContain('redrafting');
  });

  it('clears the field once the instruction is accepted', async () => {
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');

    expect(input(wrapper).element.value).toBe('');
  });

  it('keeps the typed text when the submission fails', async () => {
    // Two sentences lost to a network blip are two sentences nobody types again.
    AiDraftAPI.instruct.mockRejectedValue(instructError(502, 'unavailable'));
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'Bitte die Sendungsnummer zuerst nennen.');

    expect(input(wrapper).element.value).toBe(
      'Bitte die Sendungsnummer zuerst nennen.'
    );
  });

  it.each([
    [
      'unavailable',
      502,
      'Could not confirm the instruction reached Gotchu. Check the private notes in this conversation before sending it again.',
    ],
    [
      'refused',
      409,
      'Gotchu did not take that instruction — the draft may have moved on. Reload the conversation.',
    ],
    [
      'unconfigured',
      503,
      'Instructions are not configured on this Chatwoot, so nothing was sent.',
    ],
    [
      'invalid',
      422,
      'That instruction is empty or longer than 2000 characters.',
    ],
  ])('says a %s failure in its own words', async (reason, status, sentence) => {
    AiDraftAPI.instruct.mockRejectedValue(instructError(status, reason));
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');

    expect(wrapper.text()).toContain(sentence);
  });

  it('says it could not confirm when the failure carries no reason at all', async () => {
    // A dropped connection, or a 500. "Could not confirm", never "did not
    // happen": nothing cancels the gesture mid-flight.
    AiDraftAPI.instruct.mockRejectedValue(new Error('Network Error'));
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');

    expect(wrapper.text()).toContain('Could not confirm');
    expect(input(wrapper).element.value).toBe('kürzer bitte');
  });

  it('retries the same submission under the same token', async () => {
    // The failure a supporter actually retries is "could not confirm", which is
    // exactly the case where the first attempt may already have landed. A fresh
    // token there is a second instruction and a second redraft.
    AiDraftAPI.instruct.mockRejectedValue(instructError(502, 'unavailable'));
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');
    const first = lastRequestId();
    await arrow(wrapper).trigger('click');
    await flushPromises();

    expect(AiDraftAPI.instruct).toHaveBeenCalledTimes(2);
    expect(lastRequestId()).toBe(first);
  });

  it('mints a new token when the instruction itself changed', async () => {
    // Reusing it would be swallowed at the far end as a duplicate — the worker
    // answers `duplicate` and returns — which is a press that does nothing while
    // reporting that it worked.
    AiDraftAPI.instruct.mockRejectedValue(instructError(502, 'unavailable'));
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');
    const first = lastRequestId();
    await instruct(wrapper, 'kürzer bitte, und die Sendungsnummer nennen');

    expect(lastRequestId()).not.toBe(first);
  });

  it('mints a new token for the next instruction after one is accepted', async () => {
    const wrapper = await readyToInstruct();

    await instruct(wrapper, 'kürzer bitte');
    const first = lastRequestId();
    await instruct(wrapper, 'jetzt noch wärmer');

    expect(lastRequestId()).not.toBe(first);
  });

  it('does not read again on the strength of an acceptance', async () => {
    // The cycle only turns `redrafting` once the worker picks the job up, which
    // is after this response — so a read fired now returns the state already on
    // screen, and "nothing changed" right after an acceptance reads as the press
    // having done nothing. The 15s poll catches the flip instead.
    const wrapper = await readyToInstruct();
    const readsBefore = AiDraftAPI.getDraft.mock.calls.length;

    await instruct(wrapper, 'kürzer bitte');

    expect(AiDraftAPI.getDraft.mock.calls.length).toBe(readsBefore);
  });

  it('drops an acceptance that lands after the agent moved on', async () => {
    let resolve;
    AiDraftAPI.instruct.mockReturnValue(
      new Promise(r => {
        resolve = r;
      })
    );
    const wrapper = await readyToInstruct();

    await input(wrapper).setValue('kürzer bitte');
    await arrow(wrapper).trigger('click');
    await wrapper.setProps({ conversationId: 4471 });
    await flushPromises();
    resolve({ data: { status: 'accepted' } });
    await flushPromises();

    // The new conversation's field is empty and says nothing: the answer was
    // about the previous customer's draft.
    expect(input(wrapper).element.value).toBe('');
    expect(wrapper.text()).not.toContain('Instruction accepted');
  });

  it('forgets a half-typed instruction when the agent switches conversation', async () => {
    const wrapper = await readyToInstruct();

    await input(wrapper).setValue('kürzer bitte');
    await wrapper.setProps({ conversationId: 4471 });
    await flushPromises();

    expect(input(wrapper).element.value).toBe('');
  });
});

describe('the composer placement', () => {
  // Where the dock is mounted is the whole of this surface, and it is a fact
  // about a template rather than about a component — so a cross-check on the
  // source, rather than a mount. Mounting ReplyBox means reproducing Vuex, the
  // inbox store, the editor and the draft store, and none of that would make the
  // assertion any truer.
  const replyBox = fs.readFileSync(
    path.resolve(
      'app/javascript/dashboard/components/widgets/conversation/ReplyBox.vue'
    ),
    'utf-8'
  );

  it('mounts the container in the composer, which is the only draft surface', () => {
    expect(replyBox).toContain('<DraftDockContainer');
    expect(replyBox).toContain(':conversation-id="conversationId"');
    expect(replyBox).toContain(':channel-type="channelType"');
  });

  it('puts it inside the composer card and above the editor', () => {
    // `docs/gotchu/inbox-spec.md` §Composer: one bordered container holding an
    // optional draft dock above the editor. Below the editor it would be a
    // second toolbar; outside the card it would be a floating band.
    const card = replyBox.indexOf('class="reply-box"');
    const container = replyBox.indexOf('<DraftDockContainer');
    const editor = replyBox.indexOf('<WootMessageEditor');

    expect(card).toBeGreaterThan(-1);
    expect(container).toBeGreaterThan(card);
    expect(container).toBeLessThan(editor);
  });

  it('is the only place the draft is mounted', () => {
    // The right-hand panel placement is gone, and with it the accordion section,
    // its persisted open state and its entry in the sidebar order. Two surfaces
    // for one draft means two polls and two Inserts for one review, and the
    // design only ever had one.
    const panel = fs.readFileSync(
      path.resolve(
        'app/javascript/dashboard/routes/dashboard/conversation/ContactPanel.vue'
      ),
      'utf-8'
    );

    expect(panel).not.toContain('gotchu');
    expect(panel).not.toContain('is_gotchu_draft_open');
    expect(
      DEFAULT_CONVERSATION_SIDEBAR_ITEMS_ORDER.map(item => item.name)
    ).not.toContain('gotchu_draft');
  });
});
