<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { demotedTitle } from './ruleView';

// "Checked when saved" (board 6). The gateway's save-time checks run as the
// administrator types; the words say "checked for", never a guarantee
// (spec §10). Overlap titles come from the backend's DemotedBinding.title;
// nothing is looked up here.
const props = defineProps({
  checks: { type: Array, default: () => [] },
  overlaps: { type: Array, default: () => [] },
  replay: { type: Object, default: null },
  localProblems: { type: Array, default: () => [] },
});

const { t } = useI18n();
const R = 'GOTCHU_AGENT.RULE.';

// The conditions check's message carries the gateway parser's detail
// ("all.0.fact: unknown fact"); the other checks' messages are the spec's
// fixed sentences (§10) and pass through.
const checkMessage = check =>
  check.id === 'conditions' && !check.ok
    ? t(`${R}PROBLEM_INCOMPLETE_CONDITION`)
    : check.message;

const CLASHES = [
  'CLASH_BASE',
  'CLASH_POLICY',
  'CLASH_MEMO',
  'CLASH_RULES',
  'CLASH_PROCEDURE',
  'CLASH_MISSING',
  'CLASH_TARGET',
  'CLASH_AUTO',
  'CLASH_ACCOUNT',
];

// `lackingFacts` counts per fact, and one conversation can lack several, so
// the largest single count is the number that is certainly true.
const lacking = computed(() => {
  const counts = Object.values(props.replay?.lackingFacts ?? {});
  return counts.length ? Math.max(...counts) : 0;
});
</script>

<template>
  <div
    class="flex flex-col gap-3 bg-[var(--g-surface)] border border-[var(--g-border)] rounded-[var(--g-radius-card)] p-[18px]"
    data-testid="rule-checks"
  >
    <div>
      <h3 class="m-0 text-sm font-semibold text-[var(--g-text)]">
        {{ t(`${R}CHECKS_TITLE`) }}
      </h3>
      <p class="mt-1 mb-0 text-xs text-[var(--g-text-muted)]">
        {{ t(`${R}CHECKS_NOTE`) }}
      </p>
    </div>

    <ul class="flex flex-col gap-1.5 p-0 m-0 list-none text-sm">
      <li
        v-for="problem in localProblems"
        :key="problem"
        class="flex items-start gap-2 text-[var(--g-danger-text)]"
      >
        <span class="flex-none mt-0.5 i-lucide-x size-4" />
        {{ t(problem) }}
      </li>
      <li
        v-for="check in checks"
        :key="check.id"
        class="flex items-start gap-2"
        :class="
          check.ok ? 'text-[var(--g-text)]' : 'text-[var(--g-danger-text)]'
        "
        :data-testid="`check-${check.id}`"
      >
        <span
          class="flex-none mt-0.5 size-4"
          :class="
            check.ok ? 'i-lucide-check text-[var(--g-agent)]' : 'i-lucide-x'
          "
        />
        {{ checkMessage(check) }}
      </li>
      <li
        v-for="overlap in overlaps"
        :key="`${overlap.procedureId}-${overlap.channel}`"
        class="flex items-start gap-2 text-[var(--g-text)]"
        data-testid="rule-overlap"
      >
        <span class="flex-none mt-0.5 i-lucide-triangle-alert size-4" />
        {{
          t(`${R}OVERLAP`, {
            title: demotedTitle(overlap),
            channel: overlap.channel,
          })
        }}
      </li>
      <li
        v-if="replay"
        class="flex items-start gap-2 text-[var(--g-text)]"
        data-testid="rule-replay"
      >
        <span class="flex-none mt-0.5 i-lucide-history size-4" />
        <span>
          {{
            t(`${R}REPLAY_RESULT`, {
              matched: replay.matched,
              considered: replay.considered,
            })
          }}
          <template v-if="lacking > 0">
            {{ t(`${R}REPLAY_LACKING`, { n: lacking }) }}
          </template>
        </span>
      </li>
    </ul>

    <div class="pt-3 border-t border-[var(--g-border)]">
      <h4 class="mt-0 mb-2 text-xs font-semibold text-[var(--g-text)]">
        {{ t(`${R}CLASHES_TITLE`) }}
      </h4>
      <ul class="flex flex-col gap-1.5 p-0 m-0 list-none">
        <li
          v-for="clash in CLASHES"
          :key="clash"
          class="text-xs text-[var(--g-text-muted)]"
        >
          {{ t(`${R}${clash}`) }}
        </li>
      </ul>
    </div>
  </div>
</template>
