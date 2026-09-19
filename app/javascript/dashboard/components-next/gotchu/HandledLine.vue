<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';

// One line closing a conversation: who finished it, and how long it took. The
// dot/avatar fork is the whole component — a pink dot when Gotchu closed it, the
// person's own avatar when a human did — and it is the only place in the design
// where `--g-brand` appears beside `ApprovalCard`'s Approve button. plan.md §2:
// brand marks the HANDLED moment, never a send.
//
// Props only, and blocked on the signal rather than on the markup: nothing in
// this system can say Gotchu authored a message. It posts through the Chatwoot
// API as an ordinary agent, so `conversation.assignee` and the message sender
// both read as a person. Until something distinguishes the two, this component
// has no truthful caller.
const props = defineProps({
  // Who closed it. The NAME is the discriminator, which is the source's own
  // design and is transcribed rather than improved: a `kind: 'gotchu' | 'agent'`
  // prop would be the right shape, and it is what this should become the day
  // something real can tell an agent's reply from Gotchu's. Inventing it now
  // would mean inventing the signal that feeds it.
  by: {
    type: String,
    default: 'Gotchu',
  },
  // How long the case took, in minutes. Null renders no duration — the same
  // reasoning as `ConfidenceChip`'s missing default: there is no handling time
  // to fall back to, and `0 min` is a real value a caller may want to render, so
  // absence has to be its own case rather than a falsy one.
  minutes: {
    type: Number,
    default: null,
  },
  // The 240ms overshoot, once, as the line arrives. Off by default: a list of
  // resolved conversations would otherwise pop every row on every render, and
  // `--g-dur-pop` is documented in the token sheet as "the handled moment — the
  // only overshoot". One moment, not a screenful.
  pop: {
    type: Boolean,
    default: false,
  },
});

const { t } = useI18n();

const GOTCHU = 'Gotchu';

const isGotchu = computed(() => props.by === GOTCHU);

// `minutes != null` in the source, so `0` renders `· 0 min` and only a genuinely
// absent value renders nothing. `== null` catches undefined as well as null,
// which is what a caller spreading a partial record actually passes.
const label = computed(() =>
  props.minutes == null
    ? t('GOTCHU.HANDLED.BY', { name: props.by })
    : t('GOTCHU.HANDLED.BY_IN', { name: props.by, count: props.minutes })
);
</script>

<template>
  <span
    class="inline-flex items-center gap-2 text-xs text-[var(--g-text-muted)]"
  >
    <!-- A local span rather than `AgentDot`. AgentDot's whole job is one colour
      — `--g-agent`, for everything the assistant wrote — and this dot is the
      other one, `--g-brand`, which the token sheet caps at once per screen.
      Giving AgentDot a colour prop would put the once-per-screen accent behind a
      shared primitive that 4 call sites already use for the opposite meaning.

      Contrast, measured rather than assumed: #ff6b8b reads 2.72:1 against
      `--g-surface` in light mode and 5.45:1 in dark. `--g-brand` has no dark
      override while `--g-on-brand` flips, so brand is theme-invariant and the
      LIGHT theme is the weaker of the two — the opposite of the usual worry. The
      light figure is under the 3:1 of WCAG 1.4.11, and the only thing that makes
      that acceptable is the text beside it: the name is spelled out, so the dot
      is reinforcement and not the signal. If this dot is ever used without the
      label — an icon-only column, a dense list — that stops being true and it
      needs an outline or a darker brand in light mode. -->
    <span
      v-if="isGotchu"
      class="handled-line__dot inline-block flex-shrink-0 rounded-full size-2 bg-[var(--g-brand)]"
      :class="{ 'handled-line__dot--pop': pop }"
    />
    <!-- 16px, the source's size, which is below Avatar's own 48px threshold for
      the display face — so a person's initials here render in the body face,
      matching the meta text they sit in. -->
    <Avatar v-else :name="by" :size="16" />
    {{ label }}
  </span>
</template>

<style scoped>
/* `both`, as the source has it: the dot holds the keyframe's start state before
   the animation runs and its end state after, so it never flashes at full size
   on the first frame. The token sheet's `prefers-reduced-motion` block flattens
   this to 0.01ms, and the end state is the resting one, so a reduced-motion
   viewer sees the dot simply appear. */
.handled-line__dot--pop {
  animation: g-pop var(--g-dur-pop) var(--g-ease-out) both;
}
</style>
