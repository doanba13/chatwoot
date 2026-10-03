import fs from 'node:fs';
import path from 'node:path';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import Input from 'dashboard/components-next/input/Input.vue';
import AITrace from '../AITrace.vue';
import DraftDock from '../DraftDock.vue';

// The real catalogue: the button labels are what tell the two send paths apart,
// and under `t: key => key` they would all read as keys.
withFullI18n();

const text = 'Ihre Sendung ist unterwegs.';

// `writeEnabled` is opted into here rather than defaulted, because the dock
// defaults it to false: these tests are about the dock's full shape, and the
// read-only shape gets its own block at the bottom.
const mountComponent = (props = {}) =>
  mount(DraftDock, {
    props: { state: 'ready', text, writeEnabled: true, ...props },
  });

const buttonLabelled = (wrapper, label) =>
  wrapper.findAll('button').find(button => button.text() === label);

const instructSubmit = wrapper =>
  wrapper.find('button[aria-label="Send instruction to Gotchu"]');

const draftBody = wrapper => wrapper.find('.draft-dock__body');

// The cap is read back out of the rendered class rather than hardcoded here, so
// raising it in the component fails these tests instead of quietly passing them.
const capPxOf = wrapper => {
  const cap = draftBody(wrapper)
    .classes()
    .find(name => name.startsWith('max-h-['));

  return Number(cap?.match(/\[(\d+)px\]/)?.[1]);
};

// Measured on staging in a 1000px viewport against real production drafts: the
// dock rendered 329px for conversation 3572's 774-character draft and 349px for
// 3580's 815-character one, leaving the reply box 68–70% of the window and the
// customer's own message clipped to 216–236px.
const MEASURED_DOCK_PX = 349;

// `text-sm` is 14px/20px, so the body's line box is 20px. Backing that out of
// both measurements agrees on the chrome around it: 329 − 12×20 = 349 − 13×20.
const LINE_BOX_PX = 20;
const DOCK_CHROME_PX = 89;

// 800 characters, the middle of the 700–850 this agent writes routinely.
const eightHundredChars = 'Ihre Sendung ist unterwegs. '
  .repeat(40)
  .slice(0, 800);

// Read for the two assertions that are about a stylesheet rather than about a
// rendered component — see the reduced-motion test for why that is the strongest
// form available here.
const source = fs.readFileSync(
  path.resolve('app/javascript/dashboard/components-next/gotchu/DraftDock.vue'),
  'utf-8'
);

// Half-unit offsets throughout, so a millisecond spent between building the
// timestamp and mounting cannot flip `18.0 min` to `17 min`. A countdown test
// that straddles a tick is the shape of flake this project has already paid for
// once, and it reads as timing rather than as the bug report it is.
const inMinutes = minutes =>
  new Date(Date.now() + minutes * 60_000).toISOString();

describe('DraftDock', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing at all in the none state', () => {
    const wrapper = mountComponent({ state: 'none' });

    // Vue leaves a `<!--v-if-->` placeholder, so assert on what an agent would
    // see rather than on the markup being byte-empty.
    expect(wrapper.find('div').exists()).toBe(false);
    expect(wrapper.text()).toBe('');
  });

  it('offers exactly two paths out of a ready draft, plus discard', async () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain(text);

    await buttonLabelled(wrapper, 'Insert').trigger('click');
    await buttonLabelled(wrapper, 'Send draft').trigger('click');
    await buttonLabelled(wrapper, 'Discard').trigger('click');

    expect(wrapper.emitted('insert')).toHaveLength(1);
    expect(wrapper.emitted('send')).toHaveLength(1);
    expect(wrapper.emitted('discard')).toHaveLength(1);
  });

  it('hands an adjustment back verbatim, since it does not know what one means', async () => {
    const wrapper = mountComponent({ adjust: ['shorter', 'in French'] });

    await buttonLabelled(wrapper, 'in French').trigger('click');

    expect(wrapper.emitted('adjust')[0]).toEqual(['in French']);
  });

  it('renders no confidence chip when there is no level to render', () => {
    expect(mountComponent().text()).not.toContain('probably');
    expect(mountComponent({ confidence: 'probably' }).text()).toContain(
      'probably'
    );
  });

  it('routes a typed instruction to the agent and never to the customer', async () => {
    const wrapper = mountComponent();

    // The sentence a supporter is most likely to type is also the one the
    // deployed classifier gets wrong. Here it cannot be a send: there is no
    // path from the field to `send`, whatever the words are.
    await wrapper.find('input').setValue('send it');
    await instructSubmit(wrapper).trigger('click');

    expect(wrapper.emitted('instruct')[0]).toEqual(['send it']);
    expect(wrapper.emitted('send')).toBeUndefined();
    expect(wrapper.find('input').element.value).toBe('');
  });

  it('submits an instruction on enter as well as on the button', async () => {
    const wrapper = mountComponent();

    await wrapper.find('input').setValue('add the tracking number first');
    await wrapper.findComponent(Input).vm.$emit('enter');

    expect(wrapper.emitted('instruct')[0]).toEqual([
      'add the tracking number first',
    ]);
  });

  it('sends nothing for an instruction that is only whitespace', async () => {
    const wrapper = mountComponent();

    await wrapper.find('input').setValue('   ');

    expect(instructSubmit(wrapper).attributes('disabled')).toBeDefined();

    await instructSubmit(wrapper).trigger('click');

    expect(wrapper.emitted('instruct')).toBeUndefined();
  });

  it('offers no way to send a draft that is still arriving', async () => {
    const wrapper = mountComponent({
      state: 'streaming',
      streamingText: 'Reading the order…',
      confidence: 'probably',
    });

    expect(wrapper.text()).toContain('Reading the order…');
    expect(buttonLabelled(wrapper, 'Send draft')).toBeUndefined();
    expect(buttonLabelled(wrapper, 'Insert')).toBeUndefined();
    expect(wrapper.find('input').exists()).toBe(false);

    // Streaming and ready share a header, so the chip has a slot to appear in
    // before there is a draft to be confident about. It must not take it.
    expect(wrapper.text()).not.toContain('probably');

    await buttonLabelled(wrapper, 'stop and edit').trigger('click');

    expect(wrapper.emitted('stop')).toHaveLength(1);
  });
});

describe('DraftDock review window', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no review window when there is none to render', () => {
    expect(mountComponent().text()).not.toContain('to review');
    expect(mountComponent({ expiresAt: inMinutes(18.5) }).text()).toContain(
      '18 min to review'
    );
  });

  it('says how long is left in words rather than as a ticking clock', () => {
    // No digits counting down, no colon-separated timer: the point is that a
    // window exists and roughly how much of it is left, and a clock on a panel
    // an agent sits beside all shift is an alarm they learn to ignore.
    expect(
      mountComponent({ expiresAt: inMinutes(3 * 60 + 30) }).text()
    ).toContain('3 h to review');
    expect(mountComponent({ expiresAt: inMinutes(0.5) }).text()).toContain(
      'under a minute to review'
    );
  });

  it('says the review time ran out rather than counting into a negative', () => {
    const wrapper = mountComponent({ expiresAt: inMinutes(-5) });

    expect(wrapper.text()).toContain('review time ran out');
    expect(wrapper.text()).not.toContain('-5');
  });

  it('still offers both paths out of an expired draft', () => {
    // The dock reports the window; it does not police it. Whether a cycle really
    // expired is the worker's answer, and a browser clock a minute fast must
    // never be the reason Send draft stops working.
    const wrapper = mountComponent({ expiresAt: inMinutes(-5) });

    expect(buttonLabelled(wrapper, 'Insert')).toBeDefined();
    expect(buttonLabelled(wrapper, 'Send draft')).toBeDefined();
  });

  it('renders no review window for a timestamp it cannot parse', () => {
    // The field arrives from a queue this build does not own, and `NaN min to
    // review` is worse than no indicator at all.
    expect(mountComponent({ expiresAt: 'soonish' }).text()).not.toContain(
      'to review'
    );
  });

  it('keeps the label current while the conversation stays open', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-19T12:00:00.000Z'));

    const wrapper = mountComponent({
      expiresAt: '2026-09-19T12:18:30.000Z',
    });
    expect(wrapper.text()).toContain('18 min to review');

    // A label that reads the clock once freezes for the whole shift. This panel
    // stays open all day, so a frozen countdown is a wrong number rather than a
    // stale one.
    vi.advanceTimersByTime(60_000);
    await nextTick();

    expect(wrapper.text()).toContain('17 min to review');
  });
});

describe('DraftDock with no write surface behind it', () => {
  // What the sidebar actually renders today: the gateway's write routes are dark
  // (`GESTURE_SURFACE` unset everywhere) and their authorization is not built.
  const readOnly = (props = {}) =>
    mount(DraftDock, { props: { state: 'ready', text, ...props } });

  it('defaults to read-only, so a new mount site cannot get live buttons by accident', () => {
    const wrapper = readOnly();

    expect(buttonLabelled(wrapper, 'Insert')).toBeDefined();
    expect(buttonLabelled(wrapper, 'Send draft')).toBeUndefined();
  });

  it('hides the gestures rather than disabling them', () => {
    // A disabled Send says "not yet, wait for it", and an agent waits. A Send
    // that looks live and silently does nothing is worse: they believe the reply
    // went out. So these are absent from the DOM, not greyed out.
    const wrapper = readOnly({ adjust: ['shorter', 'in French'] });

    expect(wrapper.text()).not.toContain('Send draft');
    expect(wrapper.text()).not.toContain('Discard');
    expect(wrapper.text()).not.toContain('Adjust:');
    expect(wrapper.text()).not.toContain('in French');
    expect(wrapper.find('input').exists()).toBe(false);
    expect(instructSubmit(wrapper).exists()).toBe(false);
  });

  it('still shows the draft and the review window', () => {
    // The point of the section is that an agent can read what Gotchu wrote and
    // how long is left to act on it. Neither needs a write route.
    const wrapper = readOnly({ expiresAt: inMinutes(18.5) });

    expect(wrapper.text()).toContain(text);
    expect(wrapper.text()).toContain('18 min to review');
  });

  it('caps the draft body in the read-only shape too', () => {
    // The shape that actually ships, and the one the measurements were taken
    // against: no Send, no instruction field, just the draft and Insert.
    expect(capPxOf(readOnly({ text: eightHundredChars }))).toBe(170);
  });

  it('hides stop and still keeps the confidence chip out of the streaming header', () => {
    // `stop` is a write too. Removing it left the chip's `v-else-if` as the only
    // branch, which would have let it appear before there was a draft to be
    // confident about — the thing the streaming test above asserts against.
    const wrapper = readOnly({
      state: 'streaming',
      streamingText: 'Writing a new draft…',
      confidence: 'probably',
    });

    expect(wrapper.text()).toContain('Writing a new draft…');
    expect(wrapper.text()).not.toContain('stop and edit');
    expect(wrapper.text()).not.toContain('probably');
  });
});

describe('DraftDock draft body height', () => {
  it('caps the body at half a line box, not at a whole number of lines', () => {
    const wrapper = mountComponent({ text: eightHundredChars });

    expect(draftBody(wrapper).classes()).toContain('overflow-y-auto');
    expect(capPxOf(wrapper)).toBe(170);

    // 170 is 8.5 × 20px, and the half is the affordance. A whole multiple (160,
    // 180, 200) ends on a complete line and therefore reads as the end of the
    // draft; half a line is unmistakably a draft that continues — and being the
    // native clip rather than an overlay, it cannot obscure the line it hints at.
    expect((capPxOf(wrapper) / LINE_BOX_PX) % 1).toBe(0.5);
  });

  it('brings an 800-character draft materially below the height it measured at', () => {
    // jsdom has no layout engine and vitest runs with `css: false`, so the SFC's
    // styles are never applied and no rendered height can be read here. What can
    // be read is the cap the dock actually renders; the chrome around it is
    // backed out of the two staging measurements, which agree on 89px.
    const wrapper = mountComponent({ text: eightHundredChars });

    expect(eightHundredChars).toHaveLength(800);
    expect(DOCK_CHROME_PX + capPxOf(wrapper)).toBe(259);
    // A cap above 180px would not be worth the change, so pin the margin rather
    // than only the direction: 259px against the 349px measured.
    expect(DOCK_CHROME_PX + capPxOf(wrapper)).toBeLessThan(
      MEASURED_DOCK_PX - 80
    );
  });

  it('keeps the header and Insert outside the scroll container', () => {
    // The failure a cap must not introduce: Insert scrolling out of view. Both
    // are siblings of the body rather than children, so this is assertable
    // without layout.
    const wrapper = mountComponent({
      text: eightHundredChars,
      expiresAt: inMinutes(18.5),
    });
    const scroller = draftBody(wrapper).element;

    expect(scroller.contains(buttonLabelled(wrapper, 'Insert').element)).toBe(
      false
    );
    expect(
      scroller.contains(buttonLabelled(wrapper, 'Send draft').element)
    ).toBe(false);
    expect(scroller.textContent).not.toContain('18 min to review');
    expect(scroller.textContent).toContain(eightHundredChars.slice(0, 40));
  });

  it('scrolls the body and nothing else', () => {
    // So the cap cannot later be satisfied by wrapping the whole band in one
    // overflow container, which is the shape that takes Insert with it.
    const wrapper = mountComponent({ text: eightHundredChars });

    expect(wrapper.findAll('[class*="overflow-y-"]')).toHaveLength(1);
    expect(wrapper.find('[class*="overflow-y-"]').classes()).toContain(
      'draft-dock__body'
    );
  });

  it('leaves a short draft alone: the cap is a ceiling, not a height', () => {
    const classes = draftBody(
      mountComponent({ text: 'Danke, das ist erledigt.' })
    ).classes();

    // `max-height` alone. An `h-` or `min-h-` would reserve the full cap under a
    // one-line draft, and `overflow-y-scroll` would draw a scrollbar track on a
    // body that has nothing to scroll.
    expect(classes).toContain('max-h-[170px]');
    expect(classes.some(name => /^h-|^min-h-/.test(name))).toBe(false);
    expect(classes).not.toContain('overflow-y-scroll');
  });

  it('makes the scroll container reachable and scrollable without a mouse', () => {
    // A capped div with no tabindex is text a keyboard user cannot read to the
    // end of: the wheel scrolls it and nothing else does. `role="region"` with a
    // name is what makes the focus stop mean something when it is announced.
    const scroller = draftBody(mountComponent({ text: eightHundredChars }));

    expect(scroller.attributes('tabindex')).toBe('0');
    expect(scroller.attributes('role')).toBe('region');
    expect(scroller.attributes('aria-label')).toBe('Draft from Gotchu');
  });
});

describe('DraftDock streaming loader', () => {
  const streaming = (props = {}) =>
    mountComponent({
      state: 'streaming',
      streamingText: 'Writing a new draft…',
      ...props,
    });

  const dots = wrapper => wrapper.findAll('.draft-dock__dot');

  it('runs a loader while a redraft is being written, and none once it is ready', () => {
    expect(dots(streaming())).toHaveLength(3);
    expect(dots(mountComponent())).toHaveLength(0);
    expect(streaming().find('.draft-dock__loader').exists()).toBe(true);
    expect(mountComponent().find('.draft-dock__loader').exists()).toBe(false);
  });

  it('shows the loader whether or not there is a write surface behind it', () => {
    // It is not a gesture. `writeEnabled` hides Stop in this state; hiding the
    // one thing that says work is happening with it would leave a header that
    // looks stuck, which is what the read-only dock actually renders today.
    expect(dots(streaming({ writeEnabled: false }))).toHaveLength(3);
  });

  it('says work is happening without claiming text is arriving', () => {
    // Nothing streams between the worker and a browser. The wording is what says
    // so and has to keep saying so; the dots are decorative beside it, not a
    // second voice, and deliberately not a caret or a skeleton line in the place
    // the text will land.
    const wrapper = streaming();

    expect(wrapper.text()).toContain('Writing a new draft…');
    expect(wrapper.find('.draft-dock__loader').attributes('aria-hidden')).toBe(
      'true'
    );
    expect(draftBody(wrapper).exists()).toBe(false);
  });

  it('leaves the leading dot and the title exactly where they were', () => {
    // The loader took the status slot at the right of the header — the one the
    // confidence chip takes once the draft is ready — rather than a place in the
    // label. So becoming ready still reveals a body under a header that has not
    // moved, which is what the header's own comment protects.
    const title = streaming().element.firstElementChild.firstElementChild;

    expect(title.textContent).toContain('Writing a new draft…');
    expect(title.querySelector('.draft-dock__dot')).toBeNull();
  });

  it('degrades to something still under prefers-reduced-motion', () => {
    // A fact about a stylesheet, so a cross-check on the source rather than a
    // mount — the same reasoning DraftDockContainer.spec.js gives for the
    // composer placement. vitest runs with `css: false` and jsdom has no layout
    // engine, so an SFC's scoped styles are never applied here and no amount of
    // mounting can observe a media query.
    const reduced = source.slice(
      source.indexOf('@media (prefers-reduced-motion: reduce)')
    );

    expect(reduced).toContain('@media (prefers-reduced-motion: reduce)');
    expect(reduced).toContain('.draft-dock__dot');
    expect(reduced).toContain('animation: none');
  });

  it("times the bounce off the dock's own motion token", () => {
    expect(source).toContain('animation: g-draft-bounce var(--g-dur-pulse)');
  });

  it("keeps the loader's MIT provenance in the file", () => {
    // Attribution, not a nicety: the shape is Chatwoot's own CopilotLoader.
    expect(source).toContain('CopilotLoader');
    expect(source).toContain('MIT');
  });
});

describe('DraftDock trace and outcome', () => {
  const steps = [
    { kind: 'order', did: 'Looked up #PL-5563', result: 'PAID · 12 days old' },
    { kind: 'policy', did: 'Read the shop policy', result: '' },
  ];

  it('renders the trace with the given steps, above the draft body', () => {
    const wrapper = mountComponent({ trace: steps });
    const trace = wrapper.findComponent(AITrace);

    expect(trace.exists()).toBe(true);
    expect(trace.props('steps')).toEqual(steps);
    // Above: the trace comes before the body in document order.
    const html = wrapper.html();
    expect(html.indexOf('Looked up #PL-5563')).toBeLessThan(
      html.indexOf('draft-dock__body')
    );
  });

  it('renders no trace at all for an empty one', () => {
    const wrapper = mountComponent({ trace: [] });

    expect(wrapper.findComponent(AITrace).exists()).toBe(false);
  });

  it('shows an outcome line, and its dismiss emits dismissOutcome', async () => {
    const wrapper = mountComponent({
      outcome: { kind: 'answered', text: 'Kein Entwurf.' },
    });

    expect(wrapper.find('.draft-dock__outcome').text()).toContain(
      'Kein Entwurf.'
    );
    await wrapper.find('button[aria-label="Dismiss"]').trigger('click');

    expect(wrapper.emitted('dismissOutcome')).toHaveLength(1);
  });

  it('mutes a failed outcome instead of speaking it in the agent colour', () => {
    const wrapper = mountComponent({
      outcome: { kind: 'failed', text: 'Gotchu couldn’t finish that.' },
    });

    expect(wrapper.find('.draft-dock__outcome').classes()).toContain(
      'text-[var(--g-text-muted)]'
    );
  });

  it('shows the version label beside the title', () => {
    const wrapper = mountComponent({
      versionLabel: 'v2 · from your instruction',
    });

    expect(wrapper.text()).toContain('Draft from Gotchu');
    expect(wrapper.text()).toContain('v2 · from your instruction');
  });
});
