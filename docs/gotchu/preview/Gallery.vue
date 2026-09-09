<script setup>
import { ref, onMounted } from 'vue';

import Button from 'dashboard/components-next/button/Button.vue';
import Input from 'dashboard/components-next/input/Input.vue';
import TextArea from 'dashboard/components-next/textarea/TextArea.vue';
import Select from 'dashboard/components-next/select/Select.vue';
import Checkbox from 'dashboard/components-next/checkbox/Checkbox.vue';
import RadioCard from 'dashboard/components-next/radioCard/RadioCard.vue';
import Switch from 'dashboard/components-next/switch/Switch.vue';
import TabBar from 'dashboard/components-next/tabbar/TabBar.vue';
import Label from 'dashboard/components-next/label/Label.vue';
import Avatar from 'dashboard/components-next/avatar/Avatar.vue';
import Banner from 'dashboard/components-next/banner/Banner.vue';
import Breadcrumb from 'dashboard/components-next/breadcrumb/Breadcrumb.vue';
import Spinner from 'dashboard/components-next/spinner/Spinner.vue';
import BaseTable from 'dashboard/components-next/table/BaseTable.vue';
import AgentDot from 'dashboard/components-next/gotchu/AgentDot.vue';
import ConfidenceChip from 'dashboard/components-next/gotchu/ConfidenceChip.vue';
import AITrace from 'dashboard/components-next/gotchu/AITrace.vue';
import DraftDock from 'dashboard/components-next/gotchu/DraftDock.vue';

// SidebarGroupLeaf is deliberately absent. It calls useSidebarContext(), which
// injects a Symbol private to sidebar/provider.js and additionally needs
// usePolicy() and useUISettings() — i.e. the Vuex store. Mounting it here would
// mean reproducing half the app for one row; its re-theme is covered by its own
// 19 passing specs instead.

const dark = ref(false);
const toggleTheme = () => {
  dark.value = !dark.value;
  document.body.classList.toggle('dark', dark.value);
};

// The dashboard paints its ground on #app, not on body.
onMounted(() => {
  document.body.classList.add('bg-n-background');
});

const COLORS = ['blue', 'teal', 'ruby', 'slate', 'amber'];
const VARIANTS = ['solid', 'faded', 'outline', 'ghost', 'link'];
const SIZES = ['xs', 'sm', 'md', 'lg'];

const text = ref('PL-1095');
const area = ref('Die Sendung ist noch unterwegs.');
const checked = ref(true);
const indeterminate = ref(false);
const switched = ref(true);
const agentSwitched = ref(true);
const picked = ref('a');

const tableHeaders = [
  'Order',
  { label: 'Tracking', identifier: true },
  'Store',
  'State',
];
const rows = [
  { order: '#PL-1095', tracking: 'YWBZ2401882394', store: 'persoliebe' },
  { order: '#CU-2213', tracking: 'YT2519021088871234', store: 'cadeauniq' },
  { order: '#GE-0447', tracking: 'S34100222917', store: 'giftera' },
];

// Fixtures, not signal. Nothing in the system produces ordered trace steps or a
// confidence level yet — see plan.md Phase 6.
const traceSteps = [
  {
    kind: 'order',
    did: 'Looked up #PL-1095',
    result: 'Paid, fulfilled 12 days ago',
  },
  {
    kind: 'fulfillment',
    did: 'Checked the tracking',
    result: 'YWBZ2401882394 — last scan Leipzig, 4 days ago',
  },
  {
    kind: 'policy',
    did: 'Read the shipping policy',
    result: '14–21 days to Germany',
  },
];

const draftText =
  'Hallo Frau Weber, Ihre Sendung ist unterwegs und wurde zuletzt am 4. September in Leipzig gescannt. Für Deutschland rechnen wir mit 14–21 Tagen ab Versand.';

const lastDockAction = ref('—');
const noteDockAction = action => {
  lastDockAction.value = action;
};
</script>

<template>
  <div id="app" class="min-h-screen p-8 bg-n-background">
    <header class="flex items-center justify-between mb-8">
      <div>
        <h1
          class="m-0 text-2xl font-bold text-n-slate-12"
          style="font-family: var(--g-font-display)"
        >
          Gotchu primitives
        </h1>
        <p class="mt-1 text-sm text-n-slate-11">
          The real components-next files, the real dashboard stylesheet.
        </p>
      </div>
      <Button
        :label="dark ? 'Light' : 'Dark'"
        color="slate"
        variant="outline"
        size="sm"
        @click="toggleTheme"
      />
    </header>

    <section class="mb-10">
      <h2 class="mb-3 text-sm font-medium text-n-slate-11">
        Button — colour x variant
      </h2>
      <div class="flex flex-col gap-2">
        <div
          v-for="color in COLORS"
          :key="color"
          class="flex items-center gap-2"
        >
          <span class="w-14 text-xs text-n-slate-11">{{ color }}</span>
          <Button
            v-for="variant in VARIANTS"
            :key="variant"
            :color="color"
            :variant="variant"
            :label="variant"
          />
        </div>
      </div>
      <h2 class="mt-6 mb-3 text-sm font-medium text-n-slate-11">
        Button — sizes (24 / 32 / 36 / 40)
      </h2>
      <div class="flex items-center gap-2">
        <Button v-for="size in SIZES" :key="size" :size="size" :label="size" />
        <Button label="Loading" is-loading />
        <Button label="Disabled" disabled />
      </div>
    </section>

    <section class="grid grid-cols-2 gap-6 mb-10 max-w-3xl">
      <Input v-model="text" label="Order number" placeholder="PL-1095" />
      <Input
        v-model="text"
        label="With an error"
        message="No order matches that number"
        message-type="error"
      />
      <TextArea v-model="area" label="Reply" />
      <Select
        :options="[
          { value: 'a', label: 'persoliebe' },
          { value: 'b', label: 'cadeauniq' },
        ]"
      />
    </section>

    <section class="flex flex-wrap items-start gap-10 mb-10">
      <div class="flex flex-col gap-3">
        <h2 class="text-sm font-medium text-n-slate-11">Selection</h2>
        <Checkbox v-model="checked" label="Checked" />
        <Checkbox v-model="indeterminate" indeterminate label="Indeterminate" />
        <Switch v-model="switched" />
        <div class="flex items-center gap-2">
          <Switch v-model="agentSwitched" agent />
          <span class="text-sm text-n-slate-11">agent</span>
        </div>
      </div>
      <div class="flex flex-col gap-3 w-80">
        <RadioCard
          id="a"
          label="Gotchu handles it"
          description="Drafts a reply and waits for a supporter to approve."
          :is-active="picked === 'a'"
          @select="picked = $event"
        />
        <RadioCard
          id="b"
          label="Manual only"
          description="No drafting on this inbox."
          :is-active="picked === 'b'"
          @select="picked = $event"
        />
      </div>
      <div class="flex flex-col gap-3">
        <h2 class="text-sm font-medium text-n-slate-11">Avatar</h2>
        <div class="flex items-center gap-3">
          <Avatar name="Anna Meier" :size="32" status="online" />
          <Avatar name="Doan Ba" :size="32" status="busy" />
          <Avatar name="Jean Dupont" :size="48" />
          <Avatar
            name="persoliebe"
            :size="32"
            :inbox="{ name: 'persoliebe' }"
          />
        </div>
      </div>
    </section>

    <section class="mb-10">
      <h2 class="mb-3 text-sm font-medium text-n-slate-11">Label tones</h2>
      <div class="flex flex-wrap items-center gap-2">
        <Label label="neutral" />
        <Label label="agent" color="teal" />
        <Label label="ink" color="blue" />
        <Label label="danger" color="ruby" />
        <Label label="amber" color="amber" />
        <Label :label="{ title: 'refund', color: '#6366F1' }" />
      </div>
    </section>

    <section class="flex flex-col gap-3 mb-10 max-w-3xl">
      <Banner color="slate">Neutral, informational.</Banner>
      <Banner color="teal">Gotchu drafted a reply.</Banner>
      <Banner color="ruby">The Shopify token expired.</Banner>
      <Banner color="amber">Amber collapses to neutral — review this.</Banner>
    </section>

    <section class="flex items-center gap-8 mb-10">
      <TabBar
        :tabs="[
          { label: 'Open', count: 12 },
          { label: 'Pending' },
          { label: 'Resolved' },
        ]"
      />
      <Breadcrumb :items="[{ label: 'Settings' }, { label: 'Inboxes' }]" />
      <Spinner />
      <Spinner agent />
    </section>

    <section class="flex gap-8 mb-10">
      <div class="flex-1 max-w-2xl">
        <BaseTable :headers="tableHeaders" :items="rows">
          <!-- BaseTable hands the whole array to this slot, not one row. -->
          <template #row="{ items }">
            <tr v-for="item in items" :key="item.order">
              <td class="px-4 py-2">{{ item.order }}</td>
              <td class="px-4 py-2">{{ item.tracking }}</td>
              <td class="px-4 py-2">{{ item.store }}</td>
              <td class="px-4 py-2">
                <Label label="in transit" color="teal" />
              </td>
            </tr>
          </template>
        </BaseTable>
      </div>
    </section>

    <h2
      class="mt-4 mb-3 text-lg font-bold text-n-slate-12"
      style="font-family: var(--g-font-display)"
    >
      AI surfaces
    </h2>
    <p class="mb-6 text-sm text-n-slate-11 max-w-2xl">
      Props only. Nothing below is fed by the system: there is no
      browser-readable draft, no push for the streaming states, no ordered trace
      steps and
      <code>reply_draft.confidence</code> is null on every row.
    </p>

    <section class="mb-10">
      <h2 class="mb-3 text-sm font-medium text-n-slate-11">
        Confidence chip — and the dot
      </h2>
      <div class="flex items-center gap-3">
        <ConfidenceChip level="sure" />
        <ConfidenceChip level="probably" />
        <ConfidenceChip level="check" title="No scan since 4 September" />
        <span
          class="ml-4 inline-flex items-center gap-2 text-xs text-n-slate-11"
        >
          <AgentDot />
          resting
        </span>
        <span class="inline-flex items-center gap-2 text-xs text-n-slate-11">
          <AgentDot streaming />
          streaming
        </span>
      </div>
    </section>

    <section class="flex flex-col gap-4 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        AI trace — collapsed, open, streaming
      </h2>
      <AITrace :steps="traceSteps" />
      <AITrace :steps="traceSteps" default-open />
      <AITrace :steps="traceSteps" streaming="Reading the order…" />
      <AITrace :steps="[traceSteps[0]]" default-open />
    </section>

    <section class="flex flex-col gap-6 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Draft dock — above a composer, as it sits in the thread
      </h2>
      <div
        class="overflow-hidden border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
      >
        <DraftDock
          state="ready"
          :text="draftText"
          confidence="probably"
          :adjust="['shorter', 'warmer', 'in French']"
          @insert="noteDockAction('insert')"
          @send="noteDockAction('send')"
          @discard="noteDockAction('discard')"
          @adjust="noteDockAction(`adjust: ${$event}`)"
        />
        <div class="px-3 py-6 text-sm text-[var(--g-text-muted)]">
          The reply box goes here.
        </div>
      </div>
      <div
        class="overflow-hidden border rounded-[var(--g-radius-card)] border-[var(--g-border)] bg-[var(--g-surface)]"
      >
        <DraftDock
          state="streaming"
          streaming-text="Reading the order…"
          @stop="noteDockAction('stop')"
        />
        <div class="px-3 py-6 text-sm text-[var(--g-text-muted)]">
          The reply box goes here.
        </div>
      </div>
      <p class="text-xs text-n-slate-11">
        Last emitted: <span class="font-medium">{{ lastDockAction }}</span
        >. A dock with no confidence renders no chip, and
        <code>state="none"</code> renders nothing at all.
      </p>
      <DraftDock state="ready" :text="draftText" />
      <DraftDock state="none" />
    </section>
  </div>
</template>
