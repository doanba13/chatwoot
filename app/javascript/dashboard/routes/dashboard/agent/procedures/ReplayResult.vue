<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  replayScopeView,
  replayIsPartial,
  replayMatchCount,
} from './replayView';

/**
 * A per-row Replay is asking one question -- how many conversations would
 * have matched THIS procedure -- so this component answers that question
 * and nothing else. It used to also show a breakdown of `byResolution`,
 * which is a total across every active/testing procedure regardless of
 * which one a merchant pressed Replay on; keeping it next to a per-procedure
 * headline invited exactly the "which number is this" confusion the fix
 * round this component was extracted for exists to close. See
 * `replayMatchCount`'s own doc comment for why `byResolution` cannot answer
 * this.
 */
const props = defineProps({
  result: {
    type: Object,
    required: true,
  },
  procedureId: {
    type: Number,
    required: true,
  },
});

const { t } = useI18n();

const matchCount = computed(() =>
  replayMatchCount(props.result, props.procedureId)
);
const scope = computed(() => replayScopeView(props.result));
const partial = computed(() => replayIsPartial(props.result));
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      data-testid="replay-match-count"
      class="mb-0 text-heading-2 text-n-slate-12"
    >
      {{
        t(
          'PROCEDURES_MGMT.REPLAY.MATCH_COUNT',
          { count: matchCount },
          matchCount
        )
      }}
    </p>
    <p v-if="scope" class="mb-0 text-body-main text-n-slate-11">
      {{ t(scope.key, scope.params) }}
    </p>
    <div
      v-if="partial"
      class="flex items-center gap-2 px-3 py-2 text-sm border rounded-lg bg-n-slate-3 border-n-weak text-n-slate-12"
    >
      <span class="flex-shrink-0 i-lucide-triangle-alert size-4" />
      {{ t('PROCEDURES_MGMT.REPLAY.TIMED_OUT') }}
    </div>
  </div>
</template>
