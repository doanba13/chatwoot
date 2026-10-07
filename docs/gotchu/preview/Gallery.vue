<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

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
import HandledLine from 'dashboard/components-next/gotchu/HandledLine.vue';
import ApprovalCard from 'dashboard/components-next/gotchu/ApprovalCard.vue';
import EscalationCard from 'dashboard/components-next/gotchu/EscalationCard.vue';
import StoreSwitcher from 'dashboard/components-next/gotchu/StoreSwitcher.vue';
import AutonomyDial from 'dashboard/components-next/gotchu/AutonomyDial.vue';
import TopicSwitch from 'dashboard/components-next/gotchu/TopicSwitch.vue';
import ComposerModes from 'dashboard/components-next/gotchu/ComposerModes.vue';
import DraftInstruct from 'dashboard/components-next/gotchu/DraftInstruct.vue';
import MemoComposer from 'dashboard/components-next/gotchu/MemoComposer.vue';
import { redraftSteps } from 'dashboard/components-next/gotchu/helpers/redraftSteps';
import ComposerCard from './ComposerCard.vue';

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

// The ordinary case, not an outlier: 812 characters, inside the 700–850 this
// agent writes routinely. Uncapped, a draft this length rendered the dock at
// 349px on staging in a 1000px viewport and left the customer's own message
// clipped at 216px. The card below is what the 170px cap does to it.
const longDraftText =
  'Hallo Frau Weber, vielen Dank für Ihre Nachricht und entschuldigen Sie bitte die Verzögerung. Ihre Bestellung #PL-5563 wurde am 28. August versandt und zuletzt am 4. September im Verteilzentrum Leipzig gescannt. Da unsere Manufaktur die Anhänger einzeln gravieren lässt, verschicken wir aus Fernost, und für Deutschland rechnen wir deshalb mit 14 bis 21 Werktagen ab Versand — in Einzelfällen etwas länger, wenn der Zoll eine Sendung stichprobenartig prüft. Sie können den Stand jederzeit selbst unter dem Link in Ihrer Versandbestätigung verfolgen. Sollte die Sendung bis zum 25. September nicht bei Ihnen angekommen sein, melden Sie sich bitte kurz bei uns: wir schicken den Anhänger dann kostenfrei erneut oder erstatten den Betrag vollständig, ganz wie Sie es bevorzugen. Herzliche Grüße, Ihr Persoliebe-Team';

const lastDockAction = ref('—');

// Board 1's fixtures: Sabine, order PL-5713, a redraft in flight at 2.5 s.
const sabineDraft =
  'Hallo Sabine,\n\nvielen Dank für Ihre Nachricht. Ihre Bestellung PL-5713 wurde am 28. August versandt und zuletzt am 4. September im Verteilzentrum Leipzig gescannt. Für Deutschland rechnen wir mit 14 bis 21 Werktagen ab Versand.\n\nHerzliche Grüße\nIhr Persoliebe-Team';
const sabineParts = {
  version: 1,
  procedure: 'Where is my order',
  procedureTo: {
    name: 'agent_procedure',
    params: { accountId: 1, procedureId: 'where-is-my-order' },
  },
  tier: 'draft',
};
const instruction = ref('');
const { t } = useI18n();
const working = {
  instruction: 'Mention the 25 September date',
  canStop: true,
  steps: redraftSteps({
    elapsedMs: 2500,
    orderName: 'PL-5713',
    nextVersion: 2,
  }).map(step => ({
    key: step.key,
    state: step.state,
    text: t(`GOTCHU.COMPOSER.${step.label}`, step.params),
  })),
};
const noteDockAction = action => {
  lastDockAction.value = action;
};

// The review window, as the dock gets it: an ISO string, or null. Built at load
// rather than hardcoded, so the labels are live instead of frozen at whatever the
// file was written on.
const inMinutes = minutes =>
  new Date(Date.now() + minutes * 60_000).toISOString();

// ---------------------------------------------------------------------------
// The six transcribed-but-unwired surfaces. Every fixture below is invented for
// this page: there is no approval flow, no escalation record, no signal that
// Gotchu authored anything, no product answer on whether a store is a top-level
// scope, no stored autonomy mode and no per-topic configuration. Nothing here is
// mounted anywhere in the app.
// ---------------------------------------------------------------------------

// `--g-store-1` … `--g-store-4`, in registry order. plan.md §3: these tokens
// exist and are consumed nowhere, and the correct key is
// `conversation.custom_attributes.store_key` rather than the inbox — which is
// data wiring this page deliberately does not do.
const switcherStores = [
  {
    id: 'persoliebe',
    name: 'persoliebe',
    open: 12,
    persona: 'Lena',
    color: 'var(--g-store-1)',
  },
  {
    id: 'cadeauniq',
    name: 'cadeauniq',
    open: 4,
    persona: 'Camille',
    color: 'var(--g-store-2)',
  },
  { id: 'giftera', name: 'giftera', open: 0, color: 'var(--g-store-3)' },
  {
    id: 'paradisperso',
    name: 'paradisperso',
    open: 7,
    color: 'var(--g-store-4)',
  },
];
const activeStore = ref('cadeauniq');

// Named bindings, not the source's `⌘1`…`⌘4`: nothing registers those, and
// ReplyTopPanel's rule is to name the real one or draw none. These are drawn
// here only to exercise the opt-in branch — the card above them, which is what
// the fork would actually ship, draws no keys at all.
const switcherStoresWithKeys = switcherStores.map((store, index) => ({
  ...store,
  shortcut: `Alt+${index + 1}`,
}));

const autonomy = ref('approve');

const topics = ref([
  {
    id: 'where-is-my-order',
    name: 'Where is my order',
    meta: 'Gotchu answers with the live scan',
    on: true,
  },
  {
    id: 'delivery-window',
    name: 'How long does delivery take',
    meta: 'Waits for you',
    on: false,
  },
  {
    id: 'wrong-item',
    name: 'Wrong or damaged item',
    meta: 'Waits for you',
    on: false,
  },
  // `null`, not false: this one cannot be switched on at all, so it renders a
  // chip rather than a switch. Refunds are the case the desk keeps.
  {
    id: 'refund',
    name: 'Refund or cancellation',
    meta: 'Always a person',
    on: null,
    handler: 'Always hands over',
  },
  { id: 'chargeback', name: 'Chargeback', meta: 'Always a person', on: null },
]);
const toggleTopic = (id, value) => {
  topics.value = topics.value.map(topic =>
    topic.id === id ? { ...topic, on: value } : topic
  );
};

const approvalText =
  'Hallo Frau Weber, Ihre Sendung #PL-1095 wurde am 4. September in Leipzig gescannt und ist noch unterwegs. Für Deutschland rechnen wir mit 14–21 Tagen ab Versand — melden Sie sich bitte, wenn sie bis zum 25. September nicht da ist.';

const approvalActions = [
  { icon: 'i-lucide-send', label: 'Send this reply to Frau Weber' },
  // The source's own bare-name vocabulary, to exercise the normaliser.
  { icon: 'clock', label: 'Move the conversation to pending' },
  // No icon at all: falls through to a check rather than dropping the row.
  { label: 'Log the tracking read against the order' },
];

const lastGestureAction = ref('—');
const noteGesture = action => {
  lastGestureAction.value = action;
};

const selectStore = id => {
  activeStore.value = id;
  noteGesture(`store: ${id}`);
};

// The shared header only proves itself in motion: the point is that becoming
// ready reveals a body under a header that has not moved.
const dockState = ref('streaming');
const replayDock = () => {
  dockState.value = 'none';
  setTimeout(() => {
    dockState.value = 'streaming';
  }, 300);
  setTimeout(() => {
    dockState.value = 'ready';
  }, 2000);
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

    <section class="flex flex-col gap-6 mb-10 max-w-[760px]">
      <h2 class="text-sm font-medium text-n-slate-11">
        Composer card — the six states board 1 draws
      </h2>
      <p class="text-xs text-n-slate-11">
        One card: the draft (pill, provenance line, closed trace, body), the
        mode switch, the mode's own box and its footer. The cards below stand
        in for <code>.reply-box</code>, which needs Vuex, the inbox store and a
        conversation. Send draft is the only brand-coloured control. Toggle
        Dark above to check the pink button keeps its ink text, the body dims
        while a redraft is written, and the memo box stays dashed.
      </p>
      <!-- 1. Instruct, a draft on screen: the box is the agent's, Redraft
        sends an instruction, Insert to edit and Send draft act on the draft. -->
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="instruct"
          :text="sabineDraft"
          :expires-at="inMinutes(18.5)"
          :heading-parts="sabineParts"
          :trace="traceSteps"
          trace-summary="3 steps · memo used"
          instruct-available
          @insert="noteDockAction('insert')"
          @send="noteDockAction('send')"
          @instruct="noteDockAction('redraft')"
        >
          <template #modes>
            <ComposerModes mode="instruct" instruct-available has-draft />
          </template>
          <template #editor>
            <DraftInstruct v-model="instruction" />
          </template>
        </DraftDock>
      </ComposerCard>
      <!-- 2. Instruct, redraft in flight: the strip with its three steps (here
        at 2.5 s, so the second is done and the third is running) and Stop; the
        v1 body stays readable, dimmed; the footer is locked. -->
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="instruct"
          :text="sabineDraft"
          :heading-parts="sabineParts"
          :working="working"
          instruct-available
        >
          <template #modes>
            <ComposerModes mode="instruct" instruct-available has-draft />
          </template>
          <template #editor>
            <DraftInstruct v-model="instruction" busy />
          </template>
        </DraftDock>
      </ComposerCard>
      <!-- 3. Reply, with a draft above: Insert to edit and Send draft live in
        the instruct footer only, so here the draft is read, and the editor is
        the composer's own. -->
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="reply"
          :text="sabineDraft"
          :heading-parts="sabineParts"
          :trace="traceSteps"
          trace-summary="3 steps · memo used"
        >
          <template #modes>
            <ComposerModes mode="reply" instruct-available has-draft />
          </template>
          <template #editor>
            <div class="ed mx-[18px] mt-2.5 mb-3.5 p-3 text-sm border rounded-[10px] bg-[var(--g-surface)] border-[var(--g-border)] text-[var(--g-text-muted)]">
              Shift + Enter for a new line. Start with “/” to pick a canned reply.
            </div>
          </template>
        </DraftDock>
      </ComposerCard>
      <!-- 4. Reply, no draft: the band is gone, the mode switch and the editor
        are what is left. -->
      <ComposerCard>
        <DraftDock state="none" mode="reply">
          <template #modes>
            <ComposerModes mode="reply" />
          </template>
          <template #editor>
            <div class="ed mx-[18px] mt-2.5 mb-3.5 p-3 text-sm border rounded-[10px] bg-[var(--g-surface)] border-[var(--g-border)] text-[var(--g-text-muted)]">
              Shift + Enter for a new line. Start with “/” to pick a canned reply.
            </div>
          </template>
        </DraftDock>
      </ComposerCard>
      <!-- 5. Memo: a dashed box on the note ground, the segments, and Add memo
        in the right-hand footer row. -->
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="memo"
          :text="sabineDraft"
          :heading-parts="sabineParts"
        >
          <template #modes>
            <ComposerModes mode="memo" instruct-available has-draft />
          </template>
          <template #editor>
            <MemoComposer conversation-id="1" store-key="persoliebe" :inbox-id="4" />
          </template>
        </DraftDock>
      </ComposerCard>
      <!-- 6. Instruct, instructing switched off on this desk: no box, a resting
        line that says so (and does not read as a failed submission), and the
        footer without Redraft. -->
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="instruct"
          :text="sabineDraft"
          :heading-parts="sabineParts"
          instruct-off
        >
          <template #modes>
            <ComposerModes mode="instruct" instruct-available has-draft />
          </template>
        </DraftDock>
      </ComposerCard>
      <p class="text-xs text-n-slate-11">
        Last emitted: <span class="font-medium">{{ lastDockAction }}</span>
      </p>

      <h2 class="text-sm font-medium text-n-slate-11">
        An ordinary draft is drawn whole; only a long one scrolls
      </h2>
      <!-- The old 170px body cap is gone. The card is what is capped (here at
        420px, standing in for 70% of the viewport), and the body gives way: it
        scrolls once the card hits its ceiling, with the header and the footer
        staying put. -->
      <ComposerCard max-height="420px">
        <DraftDock
          state="ready"
          mode="instruct"
          :text="longDraftText"
          :heading-parts="sabineParts"
          :expires-at="inMinutes(42)"
          instruct-available
        >
          <template #editor>
            <DraftInstruct v-model="instruction" />
          </template>
        </DraftDock>
      </ComposerCard>
      <p class="text-xs text-n-slate-11">
        {{ longDraftText.length }} characters in a card capped at 420px. Send
        draft stays on screen; the body is reachable by keyboard — Tab into it
        and use the arrow keys.
      </p>

      <h2 class="text-sm font-medium text-n-slate-11">
        Streaming, and the review window
      </h2>
      <div class="flex items-center gap-3">
        <Button
          label="Replay streaming → ready"
          color="slate"
          variant="outline"
          size="sm"
          @click="replayDock"
        />
        <span class="text-xs text-n-slate-11">
          the header must not move when the body arrives
        </span>
      </div>
      <ComposerCard>
        <DraftDock
          :state="dockState"
          mode="instruct"
          streaming-text="Reading the order…"
          :text="draftText"
          @insert="noteDockAction('insert')"
          @send="noteDockAction('send')"
          @instruct="noteDockAction('redraft')"
        />
      </ComposerCard>
      <!-- The loader, standing still in `streaming` so it can be looked at
        without catching the replay above mid-flight: three bouncing dots in
        the status slot at the right of the header. It says work is happening
        and nothing more. Under `prefers-reduced-motion` the dots stop and
        dim. -->
      <ComposerCard>
        <DraftDock state="streaming" streaming-text="Writing a new draft…" />
      </ComposerCard>
      <p class="text-xs text-n-slate-11">
        <code>state="none"</code> renders no band at all, which is what every
        conversation with no draft shows, and most of them have none. The
        window below is hours rather than minutes, and the one after it has run
        out.
      </p>
      <ComposerCard>
        <DraftDock
          state="ready"
          :text="draftText"
          :expires-at="inMinutes(3 * 60 + 30)"
        />
      </ComposerCard>
      <ComposerCard>
        <DraftDock
          state="ready"
          mode="instruct"
          :text="draftText"
          :expires-at="inMinutes(-5)"
        />
      </ComposerCard>
      <!-- The one thing that is NOT silent. Every ordinary empty case renders
        nothing above the editor, but a read that FAILED is indistinguishable
        from "no draft" if it renders nothing — so it says why, muted, in one
        line. `DraftDockContainer` owns the real one; this is what it looks
        like. -->
      <ComposerCard>
        <p
          class="px-3 py-1.5 m-0 text-xs border-b text-[var(--g-text-muted)] border-[var(--g-border)]"
        >
          {{ $t('GOTCHU.DRAFT.NOTICE_UNAVAILABLE') }}
        </p>
      </ComposerCard>
      <ComposerCard>
        <p
          class="px-3 py-1.5 m-0 text-xs border-b text-[var(--g-text-muted)] border-[var(--g-border)]"
        >
          {{ $t('GOTCHU.DRAFT.NOTICE_UNCONFIGURED') }}
        </p>
      </ComposerCard>
    </section>

    <h2
      class="mt-4 mb-3 text-lg font-bold text-n-slate-12 font-[family-name:var(--g-font-display)]"
    >
      Transcribed, not wired
    </h2>
    <p class="mb-6 text-sm text-n-slate-11 max-w-2xl">
      Six components from the design source with no call site anywhere, because
      each one is blocked on something that does not exist: an approval flow,
      escalation records, a signal that Gotchu authored a message (it posts
      through the API as an ordinary agent), a product answer on whether a store
      is a top-level scope, a stored autonomy mode, and per-topic configuration.
      Every value below is a fixture written on this page.
    </p>

    <section class="flex flex-col gap-3 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Handled line — the pink dot is the handled moment
      </h2>
      <HandledLine :minutes="4" />
      <HandledLine by="Linh" :minutes="26" />
      <!-- 0 is a value, not an absence: a case closed inside the same minute. -->
      <HandledLine :minutes="0" />
      <!-- No duration at all renders no middot. -->
      <HandledLine by="Anna Meier" />
      <p class="text-xs text-n-slate-11">
        Toggle Dark above and watch the dot. <code>--g-brand</code> has no dark
        value while <code>--g-on-brand</code> flips, so the dot is
        theme-invariant — and the LIGHT theme is the weaker one: #ff6b8b
        measures 2.72:1 against <code>--g-surface</code> in light and 5.45:1 in
        dark. It is under WCAG 1.4.11's 3:1, which is acceptable only because
        the name is spelled out beside it.
      </p>
    </section>

    <section class="flex flex-col gap-4 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Approval card — Approve is the one brand element
      </h2>
      <ApprovalCard
        customer="Frau Weber"
        order-id="#PL-1095"
        :text="approvalText"
        :actions="approvalActions"
        confidence="probably"
        @approve="noteGesture('approve')"
        @adjust="noteGesture('adjust')"
        @hand-over="noteGesture('hand over')"
      />
      <!-- No planned actions, no order id, no confidence: an empty "Planned
        actions" heading reads as a failed load, so the section is absent
        entirely, and a card with no measured confidence renders no chip — the
        same reasoning ConfidenceChip states for refusing a default. -->
      <ApprovalCard
        customer="Jean Dupont"
        text="Bonjour, votre commande a bien été expédiée. Nous vous écrivons dès qu'un nouveau scan arrive."
        @approve="noteGesture('approve (bare)')"
        @adjust="noteGesture('adjust (bare)')"
        @hand-over="noteGesture('hand over (bare)')"
      />
    </section>

    <section class="flex flex-col gap-4 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Escalation — ink, not red. A handover is the system working.
      </h2>
      <EscalationCard
        to="Linh"
        reason="the customer asked for a refund in writing"
        action-label="Open the order"
        @action="noteGesture('escalation action')"
      />
      <EscalationCard
        to="Anna Meier"
        reason="two orders match this thread"
        note="Der Kundin wurde gesagt, dass sich jemand meldet."
      />
    </section>

    <section class="flex flex-wrap items-start gap-6 mb-10">
      <div class="flex flex-col gap-3">
        <h2 class="text-sm font-medium text-n-slate-11">
          Store switcher — the colour is a dot, never a ground
        </h2>
        <StoreSwitcher
          :stores="switcherStores"
          :active-id="activeStore"
          @select="selectStore"
        />
        <p class="text-xs text-n-slate-11 max-w-80">
          The source fills each avatar with the store colour. The token sheet
          forbids it in a comment on the tokens themselves — "8px dots and chips
          only, never a background" — so the avatar stays neutral and the colour
          is the badge dot.
        </p>
      </div>
      <div class="flex flex-col gap-3">
        <h2 class="text-sm font-medium text-n-slate-11">
          …and the opt-in shortcut hints
        </h2>
        <StoreSwitcher
          :stores="switcherStoresWithKeys"
          active-id="all"
          all-shortcut="Alt+0"
          @select="noteGesture(`store: ${$event}`)"
        />
        <p class="text-xs text-n-slate-11 max-w-80">
          Named bindings, not the source's <code>⌘1</code>…<code>⌘4</code>:
          nothing registers those. The card on the left is what the fork would
          ship — no keys at all.
        </p>
      </div>
    </section>

    <section class="flex flex-col gap-4 mb-10 max-w-3xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Autonomy dial — described by what the customer experiences
      </h2>
      <AutonomyDial :value="autonomy" @select="autonomy = $event" />
      <h2 class="mt-2 text-sm font-medium text-n-slate-11">
        …with the third mode behind a plan
      </h2>
      <AutonomyDial
        value="draft"
        :locked-ids="['handle']"
        lock-tag="Growth plan"
        @select="noteGesture(`autonomy: ${$event}`)"
      />
      <p class="text-xs text-n-slate-11">
        Two dials on one page, which is why the radio group name comes from
        <code>useId()</code> rather than a shared constant: RadioCard defaults
        its group name to its own id, so three cards would otherwise be three
        independent groups and two dials would fight over one selection.
      </p>
    </section>

    <section class="flex flex-col gap-3 mb-10 max-w-xl">
      <h2 class="text-sm font-medium text-n-slate-11">
        Topic switches — three-valued, not two
      </h2>
      <TopicSwitch :topics="topics" @toggle="toggleTopic" />
      <p class="text-xs text-n-slate-11">
        <code>on: null</code> is not <code>false</code>: the last two rows
        always hand over, so they render a chip rather than a switch someone
        could move. Teal means Gotchu handles it end to end — the meta line
        carries the same state in colour.
      </p>
      <p class="text-xs text-n-slate-11">
        Last emitted:
        <span class="font-medium">{{ lastGestureAction }}</span>
      </p>
    </section>
  </div>
</template>
