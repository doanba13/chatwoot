<script setup>
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';

// The popover off the nav rail: one row per store, and a cross-store row at the
// bottom. One accent per row.
//
// Props only, and blocked on a product answer rather than on data. In this
// deployment the four stores are INBOXES, not accounts — `store_key` is a
// conversation custom attribute the webhook receiver writes, and the shared Gmail
// inbox serves all four. Whether a store is the top level of the product, with a
// switcher at the top of the rail, was explicitly deferred. Until it is
// answered there is nothing for `activeId` to mean.
defineProps({
  // `{ id, name, open, persona?, color?, shortcut? }` each.
  stores: {
    type: Array,
    default: () => [],
  },
  // The selected store's id, or the literal `'all'` for the cross-store row.
  // Null selects nothing, which is a legitimate state for a popover that has not
  // been told what the current scope is.
  activeId: {
    type: String,
    default: null,
  },
  // The cross-store row's own shortcut hint, same rule as a store's `shortcut`
  // below: named, or not drawn.
  allShortcut: {
    type: String,
    default: null,
  },
});

defineEmits(['select']);

// The literal the bottom row emits, which is the source's own value. Named so
// the template and a caller's `activeId` comparison cannot drift.
const ALL_STORES = 'all';
</script>

<template>
  <div
    class="overflow-hidden border w-80 rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)] shadow-[var(--g-shadow-pop)]"
  >
    <button
      v-for="store in stores"
      :key="store.id"
      type="button"
      class="flex items-center w-full gap-2.5 px-3 py-2.5 text-sm text-left bg-transparent border-0 cursor-pointer text-[var(--g-text)]"
      :class="
        store.id === activeId ? 'bg-[var(--g-surface-tank)]' : 'bg-transparent'
      "
      @click="$emit('select', store.id)"
    >
      <!-- DEPARTURE from the source, which renders this as `Avatar kind:
        'store'` — an avatar whose BACKGROUND is the per-store colour. The token
        sheet forbids exactly that, in a comment on the tokens themselves:
        "per-store identity — 8px dots and chips only, never a background". The
        rule wins over the mock, for the reason the rule exists: four filled
        colour tiles in a 320px popover is four accents competing with the one
        the design allows per screen, and plan.md §3 already settled the same
        question for the conversation row in favour of a 6px dot.

        So the avatar stays neutral — tank ground, initials, exactly as every
        other avatar in the dashboard — and the store colour arrives as an 8px
        dot in Avatar's own `badge` slot. At 28px that slot computes to 8.4px and
        sits bottom-right, which is the smallest honest place to put it. No
        colour renders no dot rather than a grey one; a grey dot would read as a
        fifth store identity. -->
      <Avatar :name="store.name" :size="28">
        <template #badge>
          <span
            v-if="store.color"
            class="store-switcher__dot absolute z-20 border-2 rounded-full size-2 border-[var(--g-surface)] bottom-0 ltr:right-0 rtl:left-0"
            :style="{ background: store.color }"
          />
        </template>
      </Avatar>
      <span class="flex flex-col flex-1 min-w-0">
        <span class="font-medium truncate">{{ store.name }}</span>
        <span class="text-xs truncate text-[var(--g-text-muted)]">
          {{
            store.persona
              ? $t('GOTCHU.STORES.OPEN_PERSONA', {
                  count: store.open,
                  persona: store.persona,
                })
              : $t('GOTCHU.STORES.OPEN', { count: store.open })
          }}
        </span>
      </span>
      <!-- The source draws `⌘1`…`⌘4` here unconditionally. Those bindings do not
        exist, and `ReplyTopPanel.vue:251` already settled how this fork handles a
        drawn key with nothing behind it: name the real one, or draw none. So the
        hint is per-row and opt-in — a caller that has registered a shortcut
        passes its name, and a caller that has not draws nothing. The styling is
        `.mode-toggle__key`'s, which is where `--g-text-key` is already used. -->
      <kbd
        v-if="store.shortcut"
        class="store-switcher__key flex-shrink-0 px-1 border rounded opacity-60 border-[var(--g-border)]"
      >
        {{ store.shortcut }}
      </kbd>
    </button>
    <!-- Separated by its own top border rather than by a gap, so the popover
      stays one surface. Muted throughout: it is a scope, not a store. -->
    <button
      type="button"
      class="flex items-center w-full gap-2.5 px-3 py-2.5 text-sm text-left border-0 border-t cursor-pointer border-t-[var(--g-border)] text-[var(--g-text-muted)]"
      :class="
        activeId === ALL_STORES
          ? 'bg-[var(--g-surface-tank)]'
          : 'bg-transparent'
      "
      @click="$emit('select', ALL_STORES)"
    >
      <!-- A dashed ring where the avatars are, so the row lines up with them
        without claiming an identity of its own. -->
      <span
        class="flex-shrink-0 border border-dashed rounded-full size-7 border-[var(--g-border-strong)]"
      />
      <span class="flex-1 min-w-0 truncate">{{ $t('GOTCHU.STORES.ALL') }}</span>
      <kbd
        v-if="allShortcut"
        class="store-switcher__key flex-shrink-0 px-1 border rounded opacity-60 border-[var(--g-border)]"
      >
        {{ allShortcut }}
      </kbd>
    </button>
  </div>
</template>

<style scoped>
/* `font:` shorthand, matching `ReplyTopPanel.vue`'s `.mode-toggle__key` — the
   fork's only other keyboard hint. It is here rather than in the class attribute
   because `--g-text-key` is the one type token whose family AND weight both
   differ from the body face, which is the case plan.md §5 says the shorthand is
   for; the box around it stays in utilities, so nothing needs `@apply`. */
.store-switcher__key {
  font: var(--g-text-key);
}
</style>
