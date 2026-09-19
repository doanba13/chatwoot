# Gotchu structural half — adjudication against the live design source

Date: 2026-09-19. Source of truth read live via `DesignSync` against project
`bdf19a68-cabf-4ba1-800f-4bcdc617e082` ("Chatwoot Design System Kickoff"):
`tokens/colors.css`, `tokens/typography.css`, `tokens/spacing.css`, `github.md`
and `components/gotchu-spine.js`. Quotes below are verbatim from those files.

A brief claimed six parts of the design system had not landed. Four of the six
are already applied, blocked on data, or contradicted by the source. This file
records the adjudication so it is not re-derived, and scopes what is left.

## Summary

| # | Brief's claim | Verdict |
|---|---|---|
| 1 | Agent vs customer distinction not applied | **Already correct**, except one missing label, which is blocked on data |
| 2 | Brand accent should move to Send; Resolve to ink | **Contradicted by the source.** Brand belongs on Resolve, which is where it already is |
| 3 | Sidebar hierarchy, per-store dots | **Confirmed gap**, buildable, needs a data source the brief did not name |
| 4 | Right rail: fixed expanded sections | **Confirmed gap**, but matching it deletes a shipped feature |
| 5 | Apply `typography.css` and `spacing.css` | **Already transcribed.** Converting the remainder renders zero different pixels |
| 6 | `[data-theme="dark"]` is unwired | **False.** Wired and complete, deliberately keyed on `.dark` |

## 1. Agent vs customer — the fork is already right

`gotchu-spine.js`, `G.Message`, its own comment:

> Message — customer (left, grey), gotchu/agent (right, tank), note (right,
> dashed slate). **Same bubble for AI and human agents; a teal label marks
> Gotchu.**

The bubble map, verbatim:

```js
const bubble = {
  customer: { background: 'var(--bubble-customer)', borderBottomLeftRadius: 4 },
  gotchu:   { background: 'var(--tank)', borderBottomRightRadius: 4 },
  agent:    { background: 'var(--tank)', borderBottomRightRadius: 4 },
  note:     { border: '1px dashed var(--border-strong)', background: 'var(--surface)',
              color: 'var(--text-muted)', borderBottomRightRadius: 4 }
}[kind];
```

So an outgoing bubble is a **flat `--tank` fill with no border**. `--agent`,
`--agent-tint` and `--agent-border` appear on **no bubble at all**.

`components-next/message/bubbles/Base.vue:44-48` today:

```
AGENT:   'bg-n-solid-blue text-n-slate-12'
PRIVATE: 'bg-[var(--g-surface)] border border-dashed border-[var(--g-border-strong)] text-n-slate-11 …'
USER:    'bg-[var(--g-bubble-customer)] text-n-slate-12'
```

`bg-n-solid-blue` resolves through the compat block at
`_gotchu-tokens.scss:187` — `--solid-blue: 233 246 245` — which is `#E9F6F5`,
i.e. `--g-tank`. **The agent bubble already renders tank**, the private note
already matches, the customer bubble already matches, and
`orientationMap` already carries `--g-radius-card` with the 4px corner notch.

The brief's underlying observation is still real: `--g-bubble-customer`
(`#F0F1F0`) and `--g-tank` (`#E9F6F5`) are two pale neighbours. The design
accepts that, because three other things separate them — side, corner notch,
and the one thing the fork lacks:

```js
kind === 'gotchu'
  ? h('span', { style: { font: 'var(--text-meta)', fontWeight: 500, color: 'var(--agent)' } },
      author || 'Gotchu')
  : null,
```

### Why the label cannot be built yet — the actual blocker

The label depends on knowing **which outgoing messages Gotchu wrote**, and
nothing in Chatwoot's message payload says so. `Base.vue:30-33` can only
distinguish Captain:

```js
const isCaptainMessage = computed(
  () => (sender.value?.type ?? senderType.value) === SENDER_TYPES.CAPTAIN_ASSISTANT
);
```

Gotchu posts through the Chatwoot API **as the agent** — `post.ts` records the
Chatwoot agent id — so a Gotchu-sent reply is byte-identical to a human's in the
dashboard. A `kind: 'gotchu'` bubble is therefore not a token change; it needs
an authorship signal that does not exist today.

Three ways to get one, in ascending cost:

1. **`content_attributes` on the outgoing message.** The worker already owns the
   `POST /messages` call, so it can stamp its own key. Cheapest, and it is
   per-message rather than per-conversation.
2. **Join `reply_draft.chatwoot_message_id`** through the gateway, the way
   `/api/draft` already reads a cycle. Costs a request per conversation open.
3. **A dedicated sender type.** Matches Captain's shape, changes Rails, and
   makes every Gotchu reply visibly non-human to anyone reading the thread.

Option 1 is the recommendation. It is additive, needs no migration, and the one
place it touches is a call the worker already makes.

## 2. Brand accent — the brief has it backwards

`tokens/colors.css`, verbatim, including its comment:

```css
  --brand: var(--g-axolotl);           /* once per screen */
```

"Once per screen" is confirmed. **Which** element is the opposite of the brief.
Three independent statements in the live source put brand on the *handled
moment*, never on a send:

```js
// HandledLine — "Pink dot for Gotchu (the handled moment), avatar for a person."
h('span', { style: { width: 8, height: 8, borderRadius: 999, background: 'var(--brand)', … } })

// ApprovalCard — "Approve is the one pink."
h(Button, { color: 'brand', onClick: onApprove }, 'Approve')

// DraftDock — no brand token anywhere in it
h(Button, { color: 'agent', variant: 'outline', size: 'sm', onClick: onInsert }, 'Insert'),
h(Button, { color: 'agent', variant: 'outline', size: 'sm', onClick: onSend },   'Send draft'),
h(Button, { color: 'slate', variant: 'ghost',   size: 'sm', onClick: onDiscard },'Discard')
```

The fork already matches this. `ResolveAction.vue:206` carries
`!bg-n-axolotl`, and its comment at `:192` already says *"The one axolotl
element on the screen."* Applying the brief as written would put pink on Send
and drain it from Resolve — inverting the rule it was trying to enforce.

**One deliberate departure to keep.** The source makes Insert and Send draft
*identical* (`color: 'agent', variant: 'outline'` twice). The fork makes Send
solid, and `DraftDock.vue:262-266` records why: only one of the two reaches a
customer, and two identical buttons where one is irreversible undoes the point
of the dock. That was desk feedback on 2026-09-13. Keep the fork's version;
the departure is from a known weakness in the source, not from ignorance of it.

## 3. Store dots — the one clean gap

`--g-store-1` … `--g-store-5` exist at `_gotchu-tokens.scss:73-77` and are
consumed **nowhere**. The source's rule, verbatim from `tokens/colors.css`:

```css
  /* per-store identity — 8px dots and chips only, never a background */
```

`ConversationRow` in `gotchu-spine.js` — note the size is **6**, not the 8 in
`StoreDot`'s own default, and note the row comment *"One accent per row max."*:

```js
h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 5,
    border: '1px solid var(--border)', borderRadius: 6, padding: '0 6px',
    color: 'var(--text-muted)' } },
  h(StoreDot, { color: storeColor, size: 6 }), store),
```

### The data source the brief did not name

Store identity in a fork conversation row is `InboxName.vue` — a `ChannelIcon`
plus the inbox name. **Keying a store dot off the inbox is wrong**, and wrong
in the worst place: inbox 1 is the shared Email inbox serving all four stores
and is deliberately undeclared in the registry, so an inbox-derived dot is
blank or misleading on the majority of traffic.

The correct key is `conversation.custom_attributes.store_key`, which the
webhook receiver already writes on `conversation_created` and on later
`message_created` events. It is in the API payload; `grep -r store_key
app/javascript` finds it in no component. So this is a small data wiring job
plus a stable `store_key` → `--g-store-N` map, not a styling change.

Also missing from the row, from the same component: `borderLeft: 3px solid
var(--agent)` and `background: var(--tank)` on the selected row, and
`stateKind: 'gotchu' → 'var(--agent)'` on the assignment line.

## 4. Right rail — a gap that costs a feature

The source's rail holds five fixed, always-expanded sections with no
disclosure control of any kind. The fork's `ContactPanel.vue:12-26` renders
seven `AccordionItem`s whose open state and order persist through
`useUISettings`.

This was already declined once, for the reason that still applies: matching the
mock deletes a shipped, persisted feature. It needs a product decision, not a
token swap. Note also that the source specifies no scroll behaviour for the
rail at all (`overflow:hidden`), so the fork would have to design that part
regardless.

## 5. Type and density — already equal, by measurement

`tokens/typography.css` and `tokens/spacing.css` are transcribed in full at
`_gotchu-tokens.scss:79-118`. There is nothing to apply.

The remaining gap is that `components-next` uses Tailwind utilities rather than
`var(--g-*)`. That is a no-op, because `tailwind.config.js:206-210` is
`fontSize: { ...defaultTheme.fontSize, xxxs, xxs }` and spacing is untouched:

```
text-sm  14px/20px  ==  --g-text-body   (400 14px/20px Inter)
text-xs  12px/16px  ==  --g-text-meta   (400 12px/16px Inter)
gap-2  8px == --g-space-2 · px-3 12px == --g-space-3 · p-4 16px == --g-space-4
```

Converting them renders zero different pixels, and the `font:` shorthand resets
family and weight, so it would regress any component that sets `font-semibold`
beside a size class. Skip it.

The half of the type system that *does* change pixels is already applied where
the source says it belongs — *"IDs, SKUs, tracking, keys"*:
`--g-font-mono` at `ConversationHeader.vue:213,228`, `ShopifyOrderItem.vue:79`,
`ContactInfo.vue:301`, `BaseTable.vue:93`, `PaginationFooter.vue:102`;
`--g-font-display` at `Avatar.vue:128`; `--g-text-key` at
`ReplyTopPanel.vue:251`.

Two real holes worth noting, both in the source rather than the fork: §1b's own
markup uses `10px`, `6px`, `5px` and `2px` gaps that are off its own 4px grid
(`10px` is the second-commonest gap on the screen), and two type sizes — a 9px
micro-initial and 13px Bricolage store initials — have no `--text-*` token.
Expressing the inbox purely in `--g-space-*` is therefore not possible.

## 6. Dark mode — already wired

`_gotchu-tokens.scss:131-155` flips every semantic token; `:192-206` flips the
Radix triplets. Keyed on `.dark` rather than `[data-theme="dark"]` deliberately,
documented at `:17-18`: Chatwoot sets `document.body.classList.add('dark')` in
`dashboard/helper/themeHelper.js`. Adopting the source's selector would
*unwire* what works.

One genuine hazard inherited from the source: `--brand` is **absent from its
dark block**, in both `tokens/colors.css` and the sheet, so `#FF6B8B` is
theme-invariant while `--g-on-brand` (`--g-ink`) flips to paper. That makes
"Resolve" navy-on-pink in light and paper-on-pink in dark. `--g-danger` does
flip; brand does not. Worth a contrast check on the one brand element.

## What is actually left

1. **Store dot in the conversation row** — unblocked. Needs a `store_key` →
   `--g-store-N` map and a 6px dot in the existing meta row. Tier 2.
2. **Selected-row treatment** — 3px `--g-agent` left border plus `--g-tank`
   background, and `--g-agent` on a Gotchu-assigned state line. Tier 2.
3. **Gotchu author label** — blocked on an authorship signal. Recommend
   stamping `content_attributes` from the worker's own `POST /messages`.
4. **Brand contrast in dark mode** — measure, then decide whether to diverge
   from the source by giving `--g-brand` a dark value.

Not doing without a decision: the right rail (deletes a feature), moving brand
off Resolve (inverts the source), converting Tailwind utilities to space tokens
(no pixels change).
