<script setup>
import { reactive, ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import ProceduresAPI from 'dashboard/api/gotchu/procedures';
import { procedureErrorKey } from './errors';

import Button from 'dashboard/components-next/button/Button.vue';
import ButtonGroup from 'dashboard/components-next/buttonGroup/ButtonGroup.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';

/**
 * One row per channel (email/messenger/web) with an Off/Draft/Auto choice,
 * proxied through Gotchu::ProcedureService#bindings / #set_binding to the
 * gateway's per-channel tier store (task 13).
 *
 * `AutonomyDial.vue` is deliberately NOT reused here. Its three modes
 * (draft/approve/handle) describe a single account-wide autonomy setting
 * that does not exist anywhere yet; this screen sets a real,
 * per-(procedure, channel) tier that DOES get stored -- two stored tiers
 * (draft/auto) plus the absence of a binding row for "off", never a third
 * `off` value on the wire. Wiring AutonomyDial in here would present a
 * three-way choice ('approve' among them) that nothing on this route can
 * store.
 */
const props = defineProps({
  procedureId: {
    type: Number,
    required: true,
  },
  procedureStatus: {
    type: String,
    required: true,
  },
  // Not in the brief's original prop list: the gateway contract changed
  // after that brief was written to require `expectedVersion` on every
  // binding write, as a PRECONDITION rather than a value being set (the
  // gateway derives and stamps the actual authorised version itself). This
  // screen always sends the procedure version it loaded, so a write against
  // a procedure someone else has since revised is refused (409) rather than
  // silently landing on top of it.
  procedureVersion: {
    type: Number,
    required: true,
  },
});

const { t } = useI18n();

// Off is the absence of a binding row, never a tier value on the wire (the
// gateway's own global constraint) -- so this is the three CHANNELS this
// screen offers, not the tiers.
const CHANNELS = ['email', 'messenger', 'web'];
const TIERS = ['off', 'draft', 'auto'];

const isLoading = ref(true);
const loadErrorKey = ref('');
const bindings = ref([]);

// Keyed by channel, so one row's spinner or error never touches another's.
const updating = reactive({});
const rowErrorKey = reactive({});

const bindingFor = channel => bindings.value.find(b => b.channel === channel);
const tierFor = channel => bindingFor(channel)?.tier ?? 'off';

const autoDisabled = () => props.procedureStatus !== 'active';

// The important product fact this screen exists to surface: auto currently
// only ever SENDS on the email channel. A messenger/web row can still be
// raised to auto -- the tier is stored, exactly as asked for -- but every
// draft on those channels is refused downstream as "order not verified",
// because a visitor's identity there can be spoofed. Shown only for the
// channels it is true of, and only once that channel is actually set to
// auto, so it never crowds a row the setting doesn't apply to.
const showAutoLimitedHint = channel =>
  channel !== 'email' && tierFor(channel) === 'auto';

const loadBindings = async () => {
  isLoading.value = true;
  loadErrorKey.value = '';
  try {
    const { data } = await ProceduresAPI.bindings(props.procedureId);
    bindings.value = data.bindings || [];
  } catch (error) {
    loadErrorKey.value = procedureErrorKey(error);
  } finally {
    isLoading.value = false;
  }
};

// The PUT response is the single updated binding for this channel -- upsert
// it. A response with no tier (or a `tier: null`) means the channel is off
// again, which is the absence of a row, so it is spliced out rather than
// stored with a null tier.
const applyBindingResponse = (channel, data) => {
  const idx = bindings.value.findIndex(b => b.channel === channel);
  if (!data?.tier) {
    if (idx !== -1) bindings.value.splice(idx, 1);
    return;
  }
  if (idx !== -1) {
    bindings.value.splice(idx, 1, data);
  } else {
    bindings.value.push(data);
  }
};

const changeTier = async (channel, tier) => {
  if (tier === tierFor(channel) || updating[channel]) return;
  updating[channel] = true;
  rowErrorKey[channel] = '';
  try {
    const { data } = await ProceduresAPI.setBinding(
      props.procedureId,
      channel,
      {
        tier: tier === 'off' ? null : tier,
        expectedVersion: props.procedureVersion,
      }
    );
    applyBindingResponse(channel, data);
  } catch (error) {
    rowErrorKey[channel] = procedureErrorKey(error);
  } finally {
    updating[channel] = false;
  }
};

// The one-click de-escalation the brief asks for: an auto row's Revoke
// button lowers it back to draft, not to off -- the procedure keeps
// drafting on this channel, it just stops being trusted to send by itself.
const revoke = channel => changeTier(channel, 'draft');

const channelLabel = channel =>
  t(`PROCEDURES_MGMT.CHANNEL_TIERS.CHANNELS.${channel.toUpperCase()}`);
const tierLabel = tier =>
  t(`PROCEDURES_MGMT.CHANNEL_TIERS.TIERS.${tier.toUpperCase()}`);

onMounted(loadBindings);
</script>

<template>
  <div class="flex flex-col gap-4 pt-6 mt-6 border-t border-n-weak">
    <div>
      <h3 class="mb-1 text-heading-4 text-n-slate-12">
        {{ t('PROCEDURES_MGMT.CHANNEL_TIERS.TITLE') }}
      </h3>
      <p class="mb-0 text-sm text-n-slate-11">
        {{ t('PROCEDURES_MGMT.CHANNEL_TIERS.DESCRIPTION') }}
      </p>
    </div>

    <woot-loading-state
      v-if="isLoading"
      :message="t('PROCEDURES_MGMT.CHANNEL_TIERS.LOADING')"
    />

    <p
      v-else-if="loadErrorKey"
      class="mb-0 text-sm text-n-ruby-9"
      data-testid="channel-tiers-load-error"
    >
      {{ t(loadErrorKey) }}
    </p>

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="channel in CHANNELS"
        :key="channel"
        class="flex flex-col gap-2 px-3 py-2 border rounded-lg border-n-weak"
        :data-testid="`channel-tier-row-${channel}`"
      >
        <div class="flex items-center justify-between gap-2">
          <span
            class="flex items-center gap-2 text-sm font-medium text-n-slate-12"
          >
            {{ channelLabel(channel) }}
            <Spinner v-if="updating[channel]" :size="14" />
          </span>

          <ButtonGroup>
            <Button
              v-for="tier in TIERS"
              :key="tier"
              v-tooltip.top="
                tier === 'auto' && autoDisabled()
                  ? t('PROCEDURES_MGMT.CHANNEL_TIERS.AUTO_DISABLED_HINT')
                  : undefined
              "
              :label="tierLabel(tier)"
              size="xs"
              :variant="tierFor(channel) === tier ? 'solid' : 'faded'"
              :color="tierFor(channel) === tier ? 'blue' : 'slate'"
              :disabled="
                updating[channel] ||
                tierFor(channel) === tier ||
                (tier === 'auto' && autoDisabled())
              "
              :data-testid="`channel-tier-${channel}-${tier}`"
              @click="changeTier(channel, tier)"
            />
          </ButtonGroup>
        </div>

        <p
          v-if="tierFor(channel) === 'auto' && bindingFor(channel)"
          class="flex items-center gap-2 mb-0 text-xs text-n-slate-11"
        >
          {{
            t('PROCEDURES_MGMT.CHANNEL_TIERS.AUTHORISES_VERSION', {
              version: bindingFor(channel).authorisedVersion,
            })
          }}
          <Button
            faded
            slate
            xs
            :label="t('PROCEDURES_MGMT.CHANNEL_TIERS.REVOKE')"
            :disabled="updating[channel]"
            :data-testid="`channel-tier-${channel}-revoke`"
            @click="revoke(channel)"
          />
        </p>

        <div
          v-if="showAutoLimitedHint(channel)"
          class="flex items-start gap-2 px-2 py-1.5 text-xs border rounded-md bg-n-slate-2 border-n-weak text-n-slate-11"
          :data-testid="`channel-tier-auto-hint-${channel}`"
        >
          <span class="flex-shrink-0 mt-0.5 i-lucide-triangle-alert size-3.5" />
          {{ t('PROCEDURES_MGMT.CHANNEL_TIERS.AUTO_LIMITED_HINT') }}
        </div>

        <p
          v-if="rowErrorKey[channel]"
          class="mb-0 text-xs text-n-ruby-9"
          :data-testid="`channel-tier-error-${channel}`"
        >
          {{ t(rowErrorKey[channel]) }}
        </p>
      </div>
    </div>
  </div>
</template>
