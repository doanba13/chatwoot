# Gotchu component spec

Working reference for re-theming `app/javascript/dashboard/components-next/`.
Extracted from the Claude Design project "Chatwoot Design System Kickoff"
(`components/gotchu-core.js`, `tokens/*.css`). The design project is the source
of truth; this file is a transcription for people working in the repo.

Read `app/javascript/dashboard/assets/scss/_gotchu-tokens.scss` alongside it —
that is where every token below is actually defined.

---

## The idea, in one paragraph

Six colours, no more. **Ink** (`#14213D`) is the primary — Chatwoot's blue role
maps onto it, so primary buttons are near-black navy, not blue. **Gill**
(`#2A9D8F`, teal) means *the assistant wrote this or did this* and is never used
decoratively. **Axolotl** (`#FF6B8B`, pink) is the brand accent and appears at
most **once per screen** — it is not the primary button colour. Ruby is danger.
Slate is everything muted. A per-store palette exists for 8px dots and chips
only, never as a background.

Ink inverts in dark mode (`--g-ink` becomes paper `#FBFBFA`). Anything hardcoding
`text-white` on top of an ink surface breaks there — use `text-n-on-ink`-style
pairing, or the `--g-on-ink` token.

---

## Tokens

All CSS custom properties are prefixed `--g-`. Full list in
`_gotchu-tokens.scss`. The ones you will reach for:

| Token | Value (light) | Use |
|---|---|---|
| `--g-ink` / `--g-on-ink` | `#14213D` / `#FBFBFA` | primary surface + its text; **inverts in dark** |
| `--g-agent` | `#2A9D8F` | anything the assistant did |
| `--g-agent-tint` / `--g-agent-border` | 10% / 30% | its faded fill and outline |
| `--g-brand` / `--g-on-brand` | `#FF6B8B` / `#14213D` | once per screen |
| `--g-danger` / `--g-danger-text` | `#C8324F` / `#A8213C` | destructive |
| `--g-surface` / `--g-bg` | `#FFFFFF` / `#FBFBFA` | card / page ground |
| `--g-surface-tank` | `#E9F6F5` | selected + active rows |
| `--g-text` / `--g-text-muted` | ink / `#6B7280` | |
| `--g-border` / `--g-border-strong` | slate 20% / 40% | resting / hover outline |
| `--g-slate-tint` / `--g-slate-tint-strong` | slate 8% / 14% | input ground / segmented ground |
| `--g-scrim` | ink 40% | modal backdrop, **flat — never blurred** |

Radius: `--g-radius-control` **6px** (inputs, buttons, chips) ·
`--g-radius-card` **10px** · `--g-radius-modal` **16px** · `--g-radius-full`.

Elevation: `--g-shadow-pop` is the *one* elevation for popovers and menus.
`--g-shadow-modal` for dialogs. Nothing else casts a shadow.

Motion: `--g-dur-hover` 120ms · `--g-dur-reveal` 160ms · `--g-dur-arrive` 200ms ·
`--g-dur-pop` 240ms · `--g-ease-out` `cubic-bezier(0.2, 0, 0, 1)`.
JS equivalents in `dashboard/helper/motion.js`.

### Control heights — this is a breaking change

The design's scale is **xs 24 · sm 32 · md 36 · lg 40**. Chatwoot's today is
**xs 24 · sm 32 · md 40 · lg 48**. `md` and `lg` both shrink. Apply the design's
values; expect vertical rhythm to move in consumers and treat that as intended,
not as a regression to patch around.

---

## Per component

Only the parts that change. Anything not mentioned stays as it is — match the
surrounding code's style, and do not refactor logic that is not a colour, a
size, a radius or a duration.

### Button
Five colour roles. Map Chatwoot's existing prop values onto them rather than
renaming the prop: `blue → ink`, `teal → agent`, `ruby → danger`, `slate` stays,
and `amber` has no Gotchu equivalent — leave its entry alone rather than
inventing one.

| role | solid | faded | outline | ghost |
|---|---|---|---|---|
| ink | ink bg, on-ink text | slate-tint-strong, text | 1px ink border, text | text |
| agent | agent bg, white text | agent-tint, agent text | 1px agent, agent text | agent text |
| danger | danger bg, white text | danger-tint, danger-text | 1px danger, danger-text | danger-text |
| slate | surface bg + border, text | slate-tint-strong, text | border-strong, muted | muted text |

`solid` hover is `brightness(1.08)`; every other variant `brightness(0.94)`.
Press is `scale(0.98)`. Radius `--g-radius-control`. Font weight 500 (600 on
brand solid only).

**The `text-white` in `blue/solid` must go** — under this theme that role is ink,
which inverts, so dark mode would put white on near-white.

### Input · TextArea · Select
Ground `--g-slate-tint`, 1px `--g-border`, radius `--g-radius-control`.
Hover → `--g-border-strong`. Focus → `--g-ink` border plus a 3px `--g-slate-tint`
ring. Error → `--g-danger` border, and a 3px `--g-danger-tint` ring.
Heights 32 (sm) / 40 (md). Select gets a 14px muted chevron inset 12px right,
`appearance: none`, and a `--g-surface` ground rather than the tint.

Existing `transition-all duration-500` on Input and TextArea is wrong by a
factor of four — `--g-dur-hover`.

### Checkbox · Radio · RadioCard
Checked is **ink**, not brand. Checkbox 16px, radius 4px, check glyph in
`--g-on-ink`; indeterminate is an 8×2 bar. Radio 18px circle, checked = 5px ink
border on a surface ground. RadioCard: checked gets an ink border and a
`--g-surface-tank` fill, unchecked `--g-border` on `--g-surface`.

### Switch
28×16 track, 12px knob, knob travel `--g-dur-reveal` on `--g-ease-out`.
On-colour is **ink** for ordinary settings and **`--g-agent`** where the switch
means *the assistant handles this* — that wants a prop, defaulting to ink.

The current `cubic-bezier(0.34, 1.56, 0.64, 1)` overshoot goes. The system
reserves overshoot for the handled moment (`POP` in `helper/motion.js`), and a
settings toggle is not it.

### TabBar
Sliding pill on a `--g-slate-tint-strong` ground, 2px padding, 28px tabs, radius
6px. Active tab: `--g-surface` fill, 1px `--g-border`, a 1px soft shadow, `--g-text`.
Inactive: `--g-text-muted`, transparent. Counts render muted beside the label.

### Label
Replace `COLOR_CLASSES` with tones: `neutral` (slate-tint + border),
`agent` (agent border, agent text), `agentFilled` (tank fill), `ink`,
`danger`, `slate` (slate-tint-strong, muted), `dashed` (dashed border-strong).
A user-chosen label colour renders as an 8px rounded-square swatch inside a
`neutral` chip — the chip itself does not take the colour.

### Avatar
One palette, not per-name hashing: `--g-surface-tank` ground with `--g-text`
initials. Circle for people, rounded square (`size / 4`) for stores and inboxes.
Status dot at 30% of size, 2px `--g-surface` ring; online = `--g-agent`,
busy = muted, offline = surface with an inset ring.
Store and ≥48px avatars set their initials in `--g-font-display`.

### DropdownMenu
Panel: `--g-surface`, 1px `--g-border`, `--g-radius-card`, `--g-shadow-pop`, 6px
padding. Items 32px, radius 6px, hover `--g-slate-tint`, selected
`--g-surface-tank` with an `--g-agent` check. Section titles are **sentence
case** — Chatwoot uppercases them; stop.
Enter/exit through `motion-v` with the `REVEAL` preset.

### Dialog
`--g-radius-modal`, `--g-bg` ground, 20px padding, `--g-shadow-modal`.
Backdrop is flat `--g-scrim` — **remove `backdrop-blur-[4px]`**.
Footer keeps Chatwoot's two full-width buttons: cancel is `slate/faded`, confirm
is `ink/solid` (or `danger/solid`).
Use `AnimatePresence` with the `MODAL` and `SCRIM` presets.

### Banner
Three tones: `slate` (slate-tint + border), `agent` (tank + agent border, with a
6px agent dot at the head), `danger` (danger-tint + danger border).
Radius `--g-radius-card`. Enter with the `ARRIVE` preset.

### BaseTable · PaginationFooter
Header row: 12px muted, weight 500, no fill. Body: row rules only
(`--g-border` top borders), no zebra. Columns marked as identifiers render in
`--g-font-mono` at 13px. Footer 48px with a top border; the current-page number
sits in a `--g-slate-tint-strong` pill in mono.

### SidebarGroupLeaf
32px, radius 6px, 20px indent. Active: `--g-surface-tank` fill, `--g-text`,
weight 500. Inactive: `--g-text-muted`, hover `--g-slate-tint`.
Tree connector is a 1px `--g-border-strong` line.

### Breadcrumb · Spinner
Breadcrumb: 32px row, `›` separators in muted, last item `--g-text` weight 500,
earlier items muted. Spinner: keep `animate-spin`; colour is `--g-text-muted`,
or `--g-agent` when it is the assistant working.
