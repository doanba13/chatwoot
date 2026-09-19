<template>
  <!-- ReplyBox, in miniature, for previewing what goes between its two rows.
    The real one needs Vuex, the inbox store, the editor and a conversation, so
    this stands in for it: one bordered container on `--g-surface`, the mode
    toggles above, the editor below, and whatever is passed in between.
    `docs/gotchu/inbox-spec.md` §Composer.

    No `overflow-hidden`, deliberately, and the real `.reply-box` has none
    either: anything slotted in here sits between two rows rather than on the
    card's rounded edge, so its own bottom border is the line between it and the
    editor. -->
  <div
    class="border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
  >
    <div
      class="flex items-center gap-1.5 px-3 h-[3.25rem] text-xs text-[var(--g-text-muted)]"
    >
      <span
        class="px-2.5 py-1 border rounded-[var(--g-radius-control)] border-[var(--g-border)]"
      >
        Reply
      </span>
      <span
        class="px-2.5 py-1 border rounded-[var(--g-radius-control)] border-[var(--g-border)]"
      >
        Private note
      </span>
    </div>
    <slot />
    <div class="px-3 py-6 text-sm text-[var(--g-text-muted)]">
      The reply box goes here.
    </div>
  </div>
</template>
