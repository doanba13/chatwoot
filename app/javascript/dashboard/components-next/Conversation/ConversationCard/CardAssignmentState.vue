<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import Avatar from 'dashboard/components-next/avatar/Avatar.vue';

// The design's assignment line: a 14px avatar (or a placeholder where there is
// nobody to show) followed by who holds the conversation.
//
// The design source has THREE states and this has two. The missing one is
// `gotchu` — assigned to the agent, drawn in --g-agent with the agent's own
// mark — and it is deliberately absent rather than approximated, because
// nothing in Chatwoot's conversation payload identifies Gotchu. It replies
// through the platform API as an ordinary agent, so `meta.assignee` is a User
// like any other and `meta.assignee_type` reads `User`, not `AgentBot`. Every
// signal that could be pressed into service here (bot assignee type, a name
// match, an inbox) is a guess, and a guess rendered in --g-agent tells a
// supporter the agent is handling a case that it is not.
//
// Adding it later is one more branch in `kind` and one more entry in the colour
// map; nothing here has to be rewritten for it.
const props = defineProps({
  assignee: {
    type: Object,
    default: () => ({}),
  },
});

const { t } = useI18n();

const kind = computed(() => (props.assignee?.name ? 'human' : 'none'));

const label = computed(() =>
  kind.value === 'human'
    ? props.assignee.name
    : // Reusing the assignee filter tab's string rather than adding a key: the
      // copy is identical in every locale the dashboard ships, and the locale
      // files are not this component's to edit.
      t('CHAT_LIST.ASSIGNEE_TYPE_TABS.unassigned')
);

const TONE = {
  human: 'text-[var(--g-text)]',
  none: 'text-[var(--g-text-muted)]',
};
</script>

<template>
  <span
    class="inline-flex items-center gap-[5px] min-w-0 text-xs font-medium leading-4"
    :class="TONE[kind]"
    data-testid="card-assignment-state"
  >
    <Avatar
      v-if="kind === 'human'"
      :name="assignee.name"
      :src="assignee.thumbnail"
      :size="14"
      :status="assignee.availabilityStatus"
      rounded-full
      hide-offline-status
    />
    <!-- The placeholder's radius is written as an arbitrary property rather
    than a rounded-* utility: a separate pass owns those class names, and this
    one has no reason to be in its way. -->
    <span
      v-else
      data-testid="card-assignment-placeholder"
      class="flex-shrink-0 border border-dashed size-[14px] border-[var(--g-border-strong)] [border-radius:var(--g-radius-full)]"
    />
    <span data-testid="card-assignment-label" class="truncate">
      {{ label }}
    </span>
  </span>
</template>
