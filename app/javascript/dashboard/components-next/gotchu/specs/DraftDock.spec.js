import fs from 'node:fs';
import path from 'node:path';
import { nextTick } from 'vue';
import { mount } from '@vue/test-utils';
import { withFullI18n } from 'test-i18n';
import AITrace from '../AITrace.vue';
import DraftDock from '../DraftDock.vue';

// The real catalogue: the button labels are what tell the two send paths apart,
// and under `t: key => key` they would all read as keys.
withFullI18n();

const text = 'Ihre Sendung ist unterwegs.';

// Instruct mode by default: it is the only mode with a footer, and most of
// these tests are about the gestures in it.
const mountComponent = (props = {}) =>
  mount(DraftDock, {
    props: { state: 'ready', text, mode: 'instruct', ...props },
  });

const buttonLabelled = (wrapper, label) =>
  wrapper.findAll('button').find(button => button.text() === label);

const draftBody = wrapper => wrapper.find('.draft-dock__body');

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

  it('offers Insert to edit and Send draft out of a ready draft', async () => {
    const wrapper = mountComponent();
    expect(wrapper.text()).toContain(text);

    await buttonLabelled(wrapper, 'Insert to edit').trigger('click');
    await buttonLabelled(wrapper, 'Send draft').trigger('click');

    expect(wrapper.emitted('insert')).toHaveLength(1);
    expect(wrapper.emitted('send')).toHaveLength(1);
    expect(wrapper.text()).not.toContain('Discard');
    expect(wrapper.text()).not.toContain('Adjust:');
  });

  it('emits send only from the Send draft button', async () => {
    const wrapper = mountComponent({
      state: 'ready',
      text: 'Hallo',
      mode: 'instruct',
    });
    await wrapper.find('[data-testid="composer-insert"]').trigger('click');
    expect(wrapper.emitted('send')).toBeUndefined();
    await wrapper.find('[data-testid="composer-send-draft"]').trigger('click');
    expect(wrapper.emitted('send')).toHaveLength(1);
  });

  it('renders no footer outside Instruct mode', () => {
    expect(
      mountComponent({ state: 'ready', text: 'Hallo', mode: 'reply' })
        .find('[data-testid="composer-send-draft"]')
        .exists()
    ).toBe(false);
  });

  it('offers Redraft only where instructing is available, and emits instruct from it', async () => {
    expect(
      mountComponent().find('[data-testid="composer-redraft"]').exists()
    ).toBe(false);
    const wrapper = mountComponent({ instructAvailable: true });
    await wrapper.find('[data-testid="composer-redraft"]').trigger('click');
    expect(wrapper.emitted('instruct')).toHaveLength(1);
    expect(wrapper.emitted('send')).toBeUndefined();
  });

  it('disables Redraft when the box cannot be submitted', () => {
    const wrapper = mountComponent({
      instructAvailable: true,
      redraftDisabled: true,
    });
    expect(
      wrapper.find('[data-testid="composer-redraft"]').attributes('disabled')
    ).toBeDefined();
  });

  it('disables Send draft with a reason, and says it beside the button', () => {
    const reason = 'Replies are closed on this conversation.';
    const wrapper = mountComponent({ sendBlockedReason: reason });
    const send = wrapper.find('[data-testid="composer-send-draft"]');
    expect(send.attributes('disabled')).toBeDefined();
    expect(send.attributes('title')).toBe(reason);
    expect(wrapper.text()).toContain(reason);
  });

  it('offers no way to send or insert a draft that is still arriving', () => {
    const wrapper = mountComponent({
      state: 'streaming',
      streamingText: 'Reading the order…',
      instructAvailable: true,
    });

    expect(wrapper.text()).toContain('Reading the order…');
    ['composer-send-draft', 'composer-insert', 'composer-redraft'].forEach(
      id => {
        expect(
          wrapper.find(`[data-testid="${id}"]`).attributes('disabled')
        ).toBeDefined();
      }
    );
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

    expect(buttonLabelled(wrapper, 'Insert to edit')).toBeDefined();
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
    const title =
      streaming().find('.draft-dock').element.firstElementChild
        .firstElementChild;

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

describe('DraftDock card', () => {
  const parts = {
    version: 2,
    procedure: 'Where is my order',
    tier: 'draft',
    procedureTo: { name: 'agent_procedure', params: { procedureId: 'p1' } },
  };
  const stubs = { 'router-link': { template: '<a class="link"><slot /></a>' } };

  // Measured on staging 2026-10-16: the card's fixed parts take ~305px, so
  // under a 50vh cap a 768px-high laptop left the draft text 45px, and an
  // opened trace pushed it to 0. The region has a floor, the text keeps one of
  // its own, and only the body and the trace scroll.
  it('gives the draft text a floor and lets only the body scroll inside the card', () => {
    const wrapper = mountComponent({ text: 'x'.repeat(800) });
    const scroll = wrapper.find('.draft-dock__scroll');
    const body = wrapper.find('.draft-dock__body');
    expect(scroll.find('.draft-dock__body').exists()).toBe(true);
    expect(scroll.classes()).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'min-h-[148px]'])
    );
    expect(scroll.classes()).not.toContain('overflow-y-auto');
    expect(body.classes()).toEqual(
      expect.arrayContaining(['flex-1', 'min-h-[96px]', 'overflow-y-auto'])
    );
    expect(body.attributes('role')).toBe('region');
    expect(body.attributes('tabindex')).toBe('0');
    expect(scroll.find('[data-testid="composer-send-draft"]').exists()).toBe(
      false
    );
  });

  // An opened trace is taller than the capped card. Outside the region it
  // could not shrink and spilled over the footer; inside one shared scroller
  // it pushed the draft text out of view. It now shrinks and scrolls on its
  // own, beside a body that keeps its floor.
  it('lets an opened trace shrink and scroll on its own, never over the draft', () => {
    const wrapper = mountComponent({
      trace: [{ kind: 'policy', did: 'Read the shop policy', result: '' }],
    });
    const scroll = wrapper.find('.draft-dock__scroll');
    const trace = wrapper.find('.draft-dock__trace');
    expect(scroll.findComponent(AITrace).exists()).toBe(true);
    expect(trace.classes()).toEqual(
      expect.arrayContaining(['min-h-[34px]', 'overflow-y-auto'])
    );
    expect(scroll.find('.draft-dock__body').exists()).toBe(true);
  });

  it('splits the heading into a pill and a provenance line with a link', () => {
    const wrapper = mount(DraftDock, {
      props: { state: 'ready', text, mode: 'instruct', headingParts: parts },
      global: { stubs },
    });
    expect(wrapper.find('.draft-dock__pill').text()).toBe('Draft v2');
    expect(wrapper.find('.draft-dock__from').text()).toBe(
      'from Where is my order · tier: draft'
    );
    expect(wrapper.find('.draft-dock__from .link').text()).toBe(
      'Where is my order'
    );
  });

  it('says the procedure as plain text when no id names it', () => {
    const wrapper = mount(DraftDock, {
      props: {
        state: 'ready',
        text,
        mode: 'instruct',
        headingParts: { ...parts, procedureTo: null },
      },
      global: { stubs },
    });
    expect(wrapper.find('.draft-dock__from .link').exists()).toBe(false);
    expect(wrapper.find('.draft-dock__from').text()).toContain(
      'Where is my order'
    );
  });

  it('passes the trace summary to the trace row', () => {
    const wrapper = mountComponent({
      trace: [{ kind: 'memo', did: 'Used a memo', result: '' }],
      traceSummary: '1 step · memo used',
    });
    expect(wrapper.findComponent(AITrace).text()).toContain(
      'How it got here · 1 step · memo used'
    );
  });

  it('gives instructing-off its own resting line, not a failed submission', () => {
    const wrapper = mountComponent({ instructOff: true });
    const line = wrapper.find('.draft-dock__off');
    expect(line.text()).toContain('switched off');
    expect(line.text()).not.toContain('nothing was sent');
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

  it.each(['none', 'streaming'])(
    'shows the outcome even when the band is %s, so it is never consumed unseen',
    state => {
      const wrapper = mountComponent({
        state,
        outcome: { kind: 'refused', text: 'This draft is finished.' },
      });

      expect(wrapper.find('.draft-dock__outcome').text()).toContain(
        'This draft is finished.'
      );
    }
  );

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
