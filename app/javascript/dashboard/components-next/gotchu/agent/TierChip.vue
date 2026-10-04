<script setup>
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

// One channel's tier, worded by GOTCHU_AGENT.TIER.*: 'off', 'hand_over',
// 'draft' or 'auto', read straight from the gateway's `tiers` and never
// combined with the procedure's status (agent-screens plan decision 6).
const props = defineProps({
  tier: { type: String, default: 'off' },
});
const { t } = useI18n();
const TONE = {
  auto: 'bg-[var(--g-agent-tint)] text-[var(--g-agent)] border-[var(--g-agent-border)]',
  off: 'text-[var(--g-text-muted)] border-dashed border-[var(--g-border-strong)]',
};
const label = computed(() =>
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
  t(`GOTCHU_AGENT.TIER.${(props.tier ?? 'off').toUpperCase()}`)
);
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-[var(--g-radius-tag)]"
    :class="
      TONE[tier] ??
      'bg-[var(--g-surface)] text-[var(--g-text)] border-[var(--g-border)]'
    "
    :data-tier="tier"
  >
    {{ label }}
  </span>
</template>
