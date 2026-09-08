# Gotchu inbox spec — V1

Transcribed from `Gotchu System.dc.html` §1b (`data-screen-label="Inbox"`) in the
Claude Design project "Chatwoot Design System Kickoff". The design project is the
source of truth; this is a working copy for people editing the repo.

**This is V1, not `Gotchu Inbox v3`.** The two are different designs and v3 is
*not* what we are building. v3 is labelled "simplified" and carries its own OKLCH
palette with a four-hue signal system (teal 175 / amber 70 / red 25 / neutral
260) that contradicts the shipped token sheet — notably it adds an amber "a human
should look" role that the System palette has no equivalent for. V1 is authored
in the System tokens already in `_gotchu-tokens.scss`, so nothing in the theme
layer changes. If someone later decides v3 wins, that is a token-layer decision
first and this file is void.

Read alongside `component-spec.md` (the primitives) and `_gotchu-tokens.scss`.

---

## Frame

A four-column grid, `56px 320px minmax(0,1fr) 360px`, on `--g-bg`, 14px/20px.

| pane | width | ground |
|---|---|---|
| nav rail | 56 | `--g-bg` |
| conversation list | 320 | `--g-bg`, `border-right` |
| thread | fills | `--g-bg` |
| context rail | 360 | `--g-bg`, `border-left` |

Every divider is 1px `--g-border`. Nothing in this screen casts a shadow.

## Nav rail

Store avatars first, 32px circles, `--g-font-display` 700 at 13px:
- **active** — `--g-ink` ground, `--g-on-ink` text, plus a 2px `--g-agent` outline
  at `outline-offset: 2px`. That ring is the only thing marking the current store.
- **inactive** — `--g-surface-tank` ground, `--g-text` initials.

Below a 1px rule, the section icons: 36px squares, `--g-radius-control`, stroke
1.5. Active carries a `--g-surface-tank` ground and `--g-text`; the rest are
`--g-text-muted`. Bottom of the rail: a bell with a 6px `--g-agent` dot when
something is waiting, then the current user as a 32px `--g-ink` circle.

## Conversation list

Header block, padding `14px 16px 10px`, `border-bottom`:
- Title "All stores · Open" at `--g-text-section` (20px/28, 600).
- "Sort: newest" at `--g-text-meta`, muted.
- Filter chips Mine / Unassigned / All — `4px 10px`, `--g-radius-control`, counts
  muted. Active chip takes a `--g-surface-tank` ground and weight 500. These are
  chips, not a segmented control: no track behind them.
- A full-width **Needs approval** button, 36px, 1px `--g-ink` border,
  `--g-radius-control`, weight 500, hover `--g-surface-tank`, with a count in an
  `--g-ink` pill (`--g-on-ink` text, 18px, 11px/600).

Rows, `border-bottom` 1px:
- Padding `12px 16px 12px 13px` — the 13 is deliberate. A 3px `border-left`
  carries the selection, and 13 + 3 = 16 keeps the text aligned whether or not a
  row is selected. Do not "tidy" it to 16.
- Selected: `--g-agent` left edge and a `--g-surface-tank` ground. Unselected:
  transparent edge. Hover `--g-surface-tank`.
- Line 1 — a channel icon in `--g-text-muted`, the contact name at weight 600
  (ellipsis), the time at `--g-text-meta` muted.
- Line 2 — a store chip (1px `--g-border`, `--g-radius-control`, `0 6px`, muted)
  then the assignee at weight 500, coloured by who holds it: `--g-agent` when the
  assistant does, `--g-text` for a person, `--g-text-muted` for nobody.
- Line 3 — the subject at weight 500, ellipsis.
- Line 4 — the preview, muted, ellipsis.

## Thread

**Header**, 56px, `border-bottom`, padding `0 20px`, gap 12: the contact at weight
600, a `›`, then the subject muted and ellipsised with any order number in
`--g-font-mono`. Then, right-aligned: a status chip and an assignee chip (both 1px
`--g-border`, `--g-radius-control`, `4px 10px`), the **Mark handled** button, and a
32px overflow button.

> **Mark handled is the one axolotl element on the screen.** `--g-brand` ground,
> `--g-on-brand` text, weight 600, `4px 12px`, hover `--g-brand-hover`. The design
> spends its single pink here because it is the moment the desk is working
> toward. Nothing else in the inbox may take the brand colour.

**Message list**, padding `20px 24px`, gap 16.

| kind | side | ground | radius |
|---|---|---|---|
| customer | left, 28px avatar | `--g-bubble-customer` | card, bottom-left 4 |
| assistant / agent | right | `--g-surface-tank` | card, bottom-right 4 |
| private note | right | `--g-surface`, 1px **dashed** `--g-border-strong`, muted text | card |

Bubble padding `10px 14px`, `text-wrap: pretty`, max width 640 for customer / 560
for the right-hand side. Meta sits *below* the bubble at `--g-text-meta` muted.
An assistant bubble carries a 12px/500 `--g-agent` "Gotchu" label as its first
line; a note carries a lock icon and "Private note · <who>".

## Composer

One bordered container, `--g-radius-card`, on `--g-surface`, holding an optional
draft dock above the editor.

- Editor area, padding 12, `min-height: 44px`. Placeholder in `--g-text-muted`.
- Toolbar: **Reply** and **Private note** as bordered toggles (`4px 10px`,
  `--g-radius-control`, weight 500) each with a mono key hint in a 1px box at 60%
  opacity — `R` and `N`. Then 32px icon buttons (canned replies, attach, emoji,
  shortcuts) hovering to `--g-surface-tank`, and the send control.

## Context rail

Sections stacked, each padding 16 with a `border-bottom`:

1. **Customer** — 36px `--g-surface-tank` avatar, name at 600, "city · since
   <date>" muted. Then a four-column stat grid — Spent / Orders / Open / Disputes
   — label at `--g-text-meta` muted over a 600 value. No fills behind the stats.
2. **Order** — a box icon, the order number in `--g-font-mono`, and "Paid <date> ·
   <total>" muted on the right. Line items: 36px `--g-surface-tank` thumbnail with
   a 1px border, title ellipsised, SKU in mono muted, price muted. Then action
   chips (Cancel print, Edit address, Reprint, Refund) — 1px `--g-border`,
   `--g-radius-control`, `3px 8px`, hover `--g-surface-tank`.
3. **Fulfillment** — heading plus a state chip in `--g-agent` on `--g-agent-border`.
   A two-column `auto 1fr` grid at `--g-text-meta`: Carrier / Tracking / Last scan
   / Ships from, with the tracking number in mono.
4. **Policy** — heading plus an `--g-agent` "Edit" affordance, then the rules as
   muted 12px lines.
5. **Dispute risk** — heading plus a level chip outlined in `--g-ink`, then one
   muted line of reasoning.

## Deliberately out of scope for this pass

The AI surfaces stay untouched, as they have from the start:

- the **trace** ("Gotchu checked 3 things", collapsed and expanded)
- the **draft dock** inside the composer (streaming and ready states, Insert /
  Send draft / Discard, the Adjust row)
- the **confidence chip** (`sure` / `probably` / `check this`)

They are specified in `gotchu-spine.js` in the design project and belong with the
Captain work, once the chrome underneath them is settled.
