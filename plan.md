# Gotchu design system → Chatwoot dashboard

Branch: `feat/gotchu-design` off `develop` (`8314676d1`).
Design source: Claude Design project `Chatwoot Design System Kickoff`
(`bdf19a68-cabf-4ba1-800f-4bcdc617e082`) — `tokens/*.css`, `components/gotchu-core.js`.

Scope of this pass: **theme layer + the 18 `components-next` primitives**.
Captain / AI Agent surfaces are deliberately untouched; they get re-themed in a
later pass once the primitives underneath them are settled.

---

## Constraints discovered in the repo

1. `n-brand` is a hardcoded hex `#2781F6` at `theme/colors.js:229`, not a CSS
   variable. `Button.vue` `blue/solid` renders `bg-n-brand`, so the design's own
   compat block (which only overrides `--blue-9`/`--blue-11`) would leave every
   primary button Chatwoot blue. 105 files reference `n-brand`, including
   `widget/` (customer-facing) and `v3/` (login/onboarding), which are out of
   scope — so the token gets a **fallback** to today's blue and only the
   dashboard defines the override.

2. Dark mode is `document.body.classList.add('dark')`
   (`dashboard/helper/themeHelper.js:11`). The design ships
   `[data-theme="dark"]`. Every dark block must be rewritten to `.dark`.

3. `Button.vue` `blue/solid` hardcodes `text-white`. Under the design, `blue`
   maps to **ink**, which inverts in dark mode (`--blue-9: 251 251 250`) — white
   text on a near-white ground. This is a required component edit, not optional
   polish.

4. Chatwoot's control scale is `xs 24 / sm 32 / md 40 / lg 48`. The design's is
   `sm 32 / md 36 / lg 40` (`--control-*` in `tokens/spacing.css`). Adopting the
   design means `md` and `lg` both shrink by 4–8px, which moves layout in every
   consumer of `<Button size="md">`. Taking the design's values; noting it as the
   one deliberately disruptive change in this pass.

5. Existing motion contradicts the design in three places:
   `Input.vue` / `TextArea.vue` use `duration-500` where the design's hover token
   is `120ms`; `Switch.vue:30` uses a `cubic-bezier(0.34,1.56,0.64,1)` overshoot
   where the design reserves overshoot for "the handled moment" only;
   `Dialog.vue:181` uses `backdrop-blur-[4px]` where the design scrim is flat.

6. Fonts are self-hosted (`shared/assets/fonts/`), and Chatwoot is frequently
   deployed air-gapped. The design's `tokens/fonts.css` uses a Google Fonts
   `@import`. Self-host Bricolage Grotesque and JetBrains Mono to match repo
   convention rather than introducing a CDN dependency. Inter is already there.

---

## Phase 1 — Token layer

- [x] `app/javascript/dashboard/assets/scss/_gotchu-tokens.scss` (new) - the six-colour base palette, semantic light set, `.dark` set - spacing / radius / shadow / control heights - motion durations + easing + `g-in` / `g-pop` / `g-pulse` / `g-spin`
      keyframes + the `prefers-reduced-motion` block - the Radix compat overrides (`--blue-9`, `--teal-9`, `--ruby-9`,
      `--slate-11/12`, `--solid-blue`, `--solid-iris`, `--background-color`)
      rewritten from `[data-theme="dark"]` to `.dark` - `--brand-rgb` for the `n-brand` bridge - **verify:** all 12 compat variable names exist in `_next-colors.scss`
      (already confirmed — 2 occurrences each, `:root` + `.dark`)
- [x] Import it in `_woot.scss` **after** `_next-colors` so the overrides win at
      equal specificity, and before `_base`.
- [x] `theme/colors.js:229` — `brand: 'rgb(var(--brand-rgb, 39 129 246) / <alpha-value>)'`.
      The fallback keeps `widget/` and `v3/` on today's blue.
- [x] Type scale: add `--font-display` / `--font-mono` families and the
      `--text-*` composites.
- [x] Self-host Bricolage Grotesque + JetBrains Mono. Done via the
      `@fontsource-variable/*` packages rather than by vendoring woff2 files
      under `shared/assets/fonts/` as this line originally said — fontsource
      ships the same self-hosted files with their `@font-face` rules already
      written, so it is the same outcome without hand-managed binaries in the
      repo. Imported from `entrypoints/dashboard.js`, not from Sass: Vite
      resolves a bare package specifier in JS unambiguously, whereas from inside
      Sass it depends on the preprocessor importer, and this has to load under
      vite, vitest and histoire alike.

**Verify:** `pnpm story:dev` renders; a primary Button is ink, not blue; toggle
dark and confirm it inverts rather than going white-on-white.

## Phase 2 — Motion foundation

- [x] `pnpm add motion-v`
- [x] Wrap the dashboard root in `<MotionConfig reduced-motion="user">`
      (`App.vue`) so the library honours `prefers-reduced-motion` the same way
      the CSS block does.
- [x] Presets in `dashboard/helper/motion.js`, with the split written into its
      header: **CSS handles state transitions** (hover tint, focus ring, switch
      knob, spinner). **`motion-v` handles the case where an element must be
      held in the DOM until its exit finishes.**
- [x] Replace the contradicting durations from constraint 5 with tokens.

### Where motion-v actually landed, and why it is one place and not four

The plan named Dialog, DropdownMenu, Banner and the TabBar indicator. On
contact with the code, **none of them qualified**, and the reason is the same
in each case: they do not own their own presence.

- **Banner and DropdownMenu** are mounted behind a consumer's `v-if` — all 20
  toggled DropdownMenu call sites, every Banner call site. An exit animation
  needs `AnimatePresence` at the _call site_ to hold the element, which would
  mean touching every consumer. So the preset was only ever producing an enter,
  and an enter is what the `g-in` keyframe already does. Wrapping them cost
  real breakage: `<Motion>` inside a `shallowMount` drops its default slot, and
  `AssistantSystemSettingsForm.spec.js` failed on Banner copy that had stopped
  rendering.
- **Dialog** does own its presence (`isOpen` is internal), but its exit is
  structurally unplayable: `close()` calls the native `dialog.close()`
  synchronously, so the panel would animate inside a `display: none` subtree.
  Gating the form on `isOpen` to fix that moved initial focus off the Cancel
  button. It uses two local keyframes keyed off `dialog[open]` instead.

The one place it earns its keep is **`SnackbarContainer.vue`**, which was
already broken: it used `<transition-group name="toast-fade">` and `toast-fade`
is defined nowhere in the repo, so toasts have never animated and an expiring
toast made the ones below it jump. Messages are removed from the _front_ of the
list while later ones are still on screen, so this genuinely needs
`AnimatePresence mode="popLayout"` — an exiting toast must leave the layout flow
before the survivors move, or they animate from a position that no longer
exists.

**The lesson worth keeping:** "use motion for animation" is satisfied by one
component that needed it, not by four wrappers that each turned an enter-only
CSS animation into a JS one and broke a test on the way.

**Verify:** with OS reduced-motion on, no element animates; toasts fade and the
survivors slide up rather than jumping.

## Phase 3 — Primitives

Ordered so the highest-leverage files land first and the rest can be checked
against them.

- [x] `button/Button.vue` — `STYLE_CONFIG.colors` rewritten to the design's five
      roles (`ink` ← blue, `agent` ← teal, `danger` ← ruby, `slate`, `brand`),
      `text-white` → an ink-aware token, sizes to `24/32/36/40`,
      `rounded-lg` → `--radius-control`
- [x] `input/Input.vue`, `textarea/TextArea.vue` — slate-20% outline →
      hover 40% → focus ink, `--slate-tint` ground, `duration-500` → `--dur-hover`
- [x] `select/Select.vue` — same field base, chevron at 12px muted
- [x] `checkbox/Checkbox.vue`, `radioCard/RadioCard.vue`, `switch/Switch.vue` —
      checked state becomes ink (not brand); Switch gains the `agent` variant for
      "Gotchu handles it" and loses the overshoot
- [x] `tabbar/TabBar.vue` — sliding pill on `--slate-tint-strong`
- [x] `label/Label.vue` — `COLOR_CLASSES` → the design's `TONES`
- [x] `avatar/Avatar.vue` — one palette (tank ground, ink initials), circle for
      people / rounded square for stores, `gotchu` kind = agent circle no letter
- [x] `dropdown-menu/DropdownMenu.vue` — `--shadow-pop`, `g-in` on reveal,
      sentence-case section titles
- [x] `dialog/Dialog.vue` — radius 16, flat 40% ink scrim, no blur
- [x] `banner/Banner.vue` — slate / agent / danger tones
- [x] `table/BaseTable.vue`, `pagination/PaginationFooter.vue` — row rules only,
      mono IDs
- [x] `sidebar/SidebarGroupLeaf.vue` — tank active, 1px tree line
- [x] `breadcrumb/Breadcrumb.vue`, `spinner/Spinner.vue`

**Verify per component:** its own `*.story.vue` in histoire, light and dark.

## Phase 4 — Gate

- [ ] `pnpm eslint`
- [ ] `pnpm test` — existing specs: Avatar, SidebarGroupLeaf, Popover,
      DurationInput
- [ ] `pnpm story:build` — proves every story still compiles
- [ ] Screenshot pass over the 15 primitive stories, light + dark
- [ ] `code-reviewer` agent on the diff

**Known environment risk:** `.nvmrc` pins node `24.13.0`; this host has
`20.19.4`. If the histoire or vite build fails on an engine check, that is the
first thing to rule out.

---

## Out of scope, on purpose

- Captain / AI Agent surfaces (`components-next/captain/*`,
  `CaptainGenerationDetails.vue`, the copilot components)
- The 3-pane inbox layout, message bubbles, `ReplyBox`, `ContactPanel`
  (design files `Gotchu Inbox v2/v3`)
- `widget/` and `v3/` packs — held on today's blue by the `--brand-rgb` fallback
- The icon set (`components/gotchu-icons.js`) — Chatwoot has its own

---

# Phase 5 — The inbox screen (V1)

Spec: `docs/gotchu/inbox-spec.md`, transcribed from `Gotchu System.dc.html` §1b.

**V1, not `Gotchu Inbox v3`.** They are different designs. v3 is labelled
"simplified" and carries its own OKLCH palette with a four-hue signal system
(teal 175 / amber 70 / red 25 / neutral 260) that contradicts the shipped token
sheet — most importantly it adds an amber "a human should look" role the System
palette has no equivalent for, which would also reverse the Banner amber
decision from Phase 3. V1 is authored in the System tokens already shipped, so
the theme layer is untouched by this phase.

## Panes

- [ ] Conversation rows — `ConversationCard.vue`, `ConversationCardExpanded.vue`,
      `UnreadBadge.vue`. 3px `--g-agent` left edge replaces today's top-border
      selection; `13px` left padding is deliberate (13 + 3 = 16).
- [ ] List header — `ChatListHeader.vue`, `ConversationList.vue`,
      `ConversationBasicFilter`. Filters become chips with no track behind them.
- [ ] Bubbles — `message/bubbles/Base.vue`, `MessageMeta.vue`. The private note
      loses its amber flood for a dashed outline on `--g-surface`; that is the
      biggest visual change in the thread.
- [ ] Thread header — `ConversationHeader.vue`, `ResolveAction.vue`. **The
      resolve button becomes the one axolotl element on the screen.**
- [ ] Composer — `ReplyBox.vue`, `ReplyTopPanel.vue`, `ReplyBottomPanel.vue`.
- [ ] Context rail — `ContactPanel.vue`, its `AccordionItem`, `ContactInfo`.

## Two things deliberately not done

1. **The nav rail keeps its structure.** V1 draws a 56px rail of per-store
   avatars with a `--g-agent` ring on the active store. Chatwoot's sidebar does
   collapse to exactly 56px (`MIN_WIDTH` in `sidebar/provider.js`), so the width
   is not the problem — the mapping is. In Chatwoot the four stores are
   **inboxes**, not accounts, so a store rail is a navigation decision about what
   the top level of the product is, not a re-theme. Needs a product answer before
   anyone builds it.

2. **`ContactPanel` stays a draggable accordion.** V1 draws fixed stacked
   sections. The panel's order is reorderable and persisted in UI settings via
   vuedraggable. Matching the mock exactly would mean deleting that, which is
   trading a feature for a resemblance.

## Known collision

`UnreadBadge` is `bg-n-teal-9`, which the bridge now resolves to `--g-agent`. In
this system teal means _the assistant wrote or did this_, so an unread count in
teal says something the design does not intend. Moved to `--g-ink`, matching the
count pill in the spec's "Needs approval" control.

## Still out of scope

The AI surfaces, as from the start: the trace ("Gotchu checked 3 things"), the
draft dock inside the composer, and the confidence chip. Specified in
`gotchu-spine.js`; they belong with the Captain work.

---

# Phase 6 — The AI surfaces (props-only)

Spec: `components/gotchu-spine.js` in the design project. This phase takes the
three surfaces named as out of scope from the start — the trace, the draft dock
and the confidence chip — plus the dot the first two share.

## Why props-only, and not wired

The data behind all three is absent from this fork and from the gateway it
would read:

- **No browser can read a draft.** The gateway exposes three routes (order
  context, precedent search, feedback). Cycle and draft state live in Postgres
  reachable only from inside worker jobs. The draft dock, the trace, the
  approval card and the metrics page all wait on that one authenticated read
  path.
- **There is no push anywhere.** Panel to gateway is request/response; worker to
  Lark is an outbound socket. So `DraftDock`'s `streaming` state is a design
  state this phase renders, not a behaviour it can produce.
- **`reply_draft.confidence` is a real column written `null` on every draft.**
  The chip has a schema slot and no signal.
- **The trace has no ordered steps.** Only the finished `rendered_context` is
  stored — never "looked up #PL-1095 → unfulfilled".

So these are pure presentation components, driven entirely by props and
exercised in the preview gallery, exactly as the Phase 3 primitives were. No
call site in `ReplyBox`, the message list or the conversation header is
touched; wiring them to a fixture store would only be wiring to delete once the
read path lands.

## Files

- [x] `components-next/gotchu/AgentDot.vue` — the spine ships `AgentDot` and
      `StreamingDot`, identical but for the pulse. One component, one prop.
- [x] `components-next/gotchu/ConfidenceChip.vue` — three plain words, teal
      outline, never a percentage.
- [x] `components-next/gotchu/AITrace.vue` — collapsed to a count, expands
      inline on `--g-dur-reveal`. Never a modal.
- [x] `components-next/gotchu/DraftDock.vue` — `none` / `streaming` / `ready`.
      Two paths plus discard.
- [x] `GOTCHU` block in `i18n/locale/en/components.json`, and the same keys in
      the preview harness's bare i18n instance.
- [x] Gallery sections for all four, light and dark.
- [x] Specs for `AITrace` and `DraftDock` — the two with branching. The chip and
      the dot are covered by the gallery.

## Deliberate departures from the spine

1. **No keyboard hint on "stop and edit".** The spine draws a `S` key. No such
   shortcut exists, and `ReplyTopPanel` already set the precedent in Phase 5 of
   naming the real binding rather than the drawn one. Drawing a key that does
   nothing is worse than drawing none.
2. **The confidence chip takes no default level.** A caller that has no signal
   must render no chip rather than a chip that says `probably` about nothing —
   which is what a default would produce today, on every draft in production.

**Verify:** `pnpm exec vite --config docs/gotchu/preview/vite.config.mjs`
(`story:build` is broken on this fork independently of this work), light and
dark; `pnpm test` for the two specs; `pnpm eslint` on the new files.
