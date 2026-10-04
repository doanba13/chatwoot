<script setup>
import { computed, reactive, ref, onMounted } from 'vue';
import { useI18n, Translation } from 'vue-i18n';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { gatewayErrorKey } from 'dashboard/components-next/gotchu/agent/gatewayErrors';
import { CHANNELS, tierFor, tierOptions, holdHint } from './procedureView';

/**
 * "May send on its own": one row per channel (email/messenger/web) with an
 * Off · Hand over · Draft · Auto choice, proxied through
 * Gotchu::ProcedureService#bindings / #set_binding to the gateway's
 * per-channel tier store. Ported from settings/procedures/ChannelTiers.vue.
 *
 * Off is the absence of a binding row, never a tier value on the wire: it is
 * written as `tier: null`, which Rails maps to an explicit null for the
 * gateway. The tier shown is the stored one whatever the procedure's status
 * (agent-screens plan decision 6); the editor's header pill says the status,
 * and this panel never folds the status into the tier.
 */
const props = defineProps({
  procedure: { type: Object, required: true },
  readOnly: { type: Boolean, default: false },
});

const { t } = useI18n();
// The label name is the gateway's own constant, never translated.
const KILL_LABEL = 'gotchu-manual';

const isLoading = ref(true);
const loadErrorKey = ref('');
const bindings = ref([]);

// Keyed by channel, so one row's spinner or error never touches another's.
const updating = reactive({});
const rowErrorKey = reactive({});

const bindingFor = channel => bindings.value.find(b => b.channel === channel);
const currentTier = channel => tierFor(bindings.value, channel);

const options = computed(() =>
  Object.fromEntries(
    CHANNELS.map(channel => [channel, tierOptions(props.procedure, channel)])
  )
);
const autoOption = channel =>
  options.value[channel].find(o => o.value === 'auto');
const hint = computed(() => holdHint(props.procedure));

// Why this row's Auto reads as it does: the reason Auto is off when it is,
// and the hold hint on the email row, the one channel Auto can send on.
const whyLine = channel => {
  const auto = autoOption(channel);
  if (auto.disabled) return t(auto.reasonKey);
  if (channel === 'email') return t(hint.value.key, hint.value.params);
  return '';
};

const loadBindings = async () => {
  isLoading.value = true;
  loadErrorKey.value = '';
  try {
    const { data } = await ProceduresAPI.bindings(props.procedure.id);
    bindings.value = data.bindings || [];
  } catch (error) {
    loadErrorKey.value = gatewayErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

// The gateway wraps the PUT response as `{ binding: {...} }`, or
// `{ binding: null }` when the write turned the channel off -- never a bare
// binding at the top level. Reading `data.tier` here (instead of
// `data.binding.tier`) used to be indistinguishable from "off" on EVERY
// successful write, because the wrapper object itself has no `.tier` -- so
// every write rendered as Off and hid Revoke while auto was actually live
// underneath it. `binding` is the already-unwrapped payload; null means the
// row is gone.
const applyBindingResponse = (channel, binding) => {
  const rest = bindings.value.filter(b => b.channel !== channel);
  bindings.value = binding ? [...rest, binding] : rest;
};

const isDisabled = (channel, option) =>
  props.readOnly || option.disabled || Boolean(updating[channel]);

const changeTier = async (channel, tier) => {
  if (props.readOnly || tier === currentTier(channel) || updating[channel])
    return;
  updating[channel] = true;
  rowErrorKey[channel] = '';
  try {
    // `expectedVersion` is a PRECONDITION, not a value being set: the gateway
    // derives and stamps the authorised version itself. Sending the version
    // this page loaded means a write against a procedure someone else has
    // since revised is refused (409) rather than silently landing on top.
    const { data } = await ProceduresAPI.setBinding(
      props.procedure.id,
      channel,
      {
        tier: tier === 'off' ? null : tier,
        expectedVersion: props.procedure.version,
      }
    );
    applyBindingResponse(channel, data.binding);
  } catch (error) {
    rowErrorKey[channel] = gatewayErrorKey(error);
  } finally {
    updating[channel] = false;
  }
};

// The one-click de-escalation: an auto row's Revoke lowers it back to draft,
// not to off -- the procedure keeps drafting on this channel, it just stops
// being trusted to send by itself.
const revoke = channel => changeTier(channel, 'draft');

// eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
const channelLabel = channel =>
  t(`GOTCHU_AGENT.CHANNEL.${channel.toUpperCase()}`);
// eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys
const tierLabel = tier => t(`GOTCHU_AGENT.TIER.${tier.toUpperCase()}`);

const segmentClass = (channel, tier) => {
  if (currentTier(channel) !== tier) return 'text-[var(--g-text-muted)]';
  if (tier === 'auto') return 'bg-[var(--g-agent)] text-white shadow-sm';
  return 'bg-[var(--g-surface)] text-[var(--g-text)] shadow-sm';
};

onMounted(loadBindings);
</script>

<template>
  <div class="flex flex-col gap-3">
    <p
      v-if="isLoading"
      class="mb-0 text-sm text-[var(--g-text-muted)]"
      data-testid="procedure-tiers-loading"
    >
      {{ t('GOTCHU_AGENT.PROCEDURE.TIERS_LOADING') }}
    </p>
    <p
      v-else-if="loadErrorKey"
      class="mb-0 text-sm text-[var(--g-danger-text)]"
      data-testid="procedure-tiers-load-error"
    >
      {{ t(loadErrorKey) }}
    </p>

    <template v-else>
      <div
        v-for="channel in CHANNELS"
        :key="channel"
        class="flex flex-col gap-1.5"
        :data-testid="`procedure-tier-row-${channel}`"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm font-medium text-[var(--g-text)]">
            {{ channelLabel(channel) }}
          </span>
          <div
            class="inline-flex p-0.5 gap-0.5 rounded-[var(--g-radius-segment)] bg-[var(--g-slate-tint)]"
            role="group"
            :aria-label="channelLabel(channel)"
          >
            <button
              v-for="option in options[channel]"
              :key="option.value"
              type="button"
              class="px-2.5 py-1 text-xs font-semibold border-0 rounded-[calc(var(--g-radius-segment)-2px)] disabled:cursor-not-allowed"
              :class="[
                segmentClass(channel, option.value),
                option.disabled ? 'opacity-50' : '',
              ]"
              :disabled="isDisabled(channel, option)"
              :aria-pressed="currentTier(channel) === option.value"
              :title="option.reasonKey ? t(option.reasonKey) : undefined"
              :data-testid="`tier-${channel}-${option.value}`"
              @click="changeTier(channel, option.value)"
            >
              {{ tierLabel(option.value) }}
            </button>
          </div>
        </div>

        <p
          v-if="whyLine(channel)"
          class="mb-0 text-xs text-[var(--g-text-muted)]"
          :data-testid="`tier-why-${channel}`"
        >
          {{ whyLine(channel) }}
        </p>

        <p
          v-if="currentTier(channel) === 'auto' && bindingFor(channel)"
          class="flex items-center gap-2 mb-0 text-xs text-[var(--g-text-muted)]"
        >
          {{
            t('GOTCHU_AGENT.PROCEDURE.AUTHORISES_VERSION', {
              version: bindingFor(channel).authorisedVersion,
            })
          }}
          <button
            v-if="!readOnly"
            type="button"
            class="px-2 py-0.5 text-xs font-semibold border rounded-[var(--g-radius-control)] border-[var(--g-border)] bg-[var(--g-surface)] text-[var(--g-text)]"
            :disabled="updating[channel]"
            :data-testid="`revoke-${channel}`"
            @click="revoke(channel)"
          >
            {{ t('GOTCHU_AGENT.PROCEDURE.REVOKE') }}
          </button>
        </p>

        <p
          v-if="rowErrorKey[channel]"
          class="mb-0 text-xs text-[var(--g-danger-text)]"
          :data-testid="`tier-error-${channel}`"
        >
          {{ t(rowErrorKey[channel]) }}
        </p>
      </div>
    </template>

    <Translation
      keypath="GOTCHU_AGENT.PROCEDURE.KILL_LABEL"
      tag="p"
      class="pt-3 mb-0 text-xs border-t border-[var(--g-border)] text-[var(--g-text-muted)]"
    >
      <template #label>
        <span class="[font-family:var(--g-font-mono)]">{{ KILL_LABEL }}</span>
      </template>
    </Translation>
  </div>
</template>
