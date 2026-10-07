<script setup>
import MessageList from 'dashboard/components-next/message/MessageList.vue';

// Two days: yesterday's mail and its sent reply, then today's follow-up. Times
// are built from now so "Today" and "Yesterday" read as such on any day.
const at = (daysAgo, hour, minute) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d;
};
const seconds = d => Math.floor(d.getTime() / 1000);

const base = {
  conversation_id: 3580,
  inbox_id: 1,
  status: 'sent',
  private: false,
  content_attributes: {},
  attachments: [],
};

const messages = [
  {
    ...base,
    id: 501,
    message_type: 0,
    content: 'Hallo, meine Bestellung PL-1095 ist noch nicht angekommen.',
    created_at: seconds(at(1, 9, 12)),
    sender: { id: 7, type: 'contact', name: 'Anna Keller' },
  },
  {
    ...base,
    id: 502,
    message_type: 1,
    content:
      'Hallo Anna, Ihre Sendung ist unterwegs und sollte in wenigen Tagen ankommen.',
    created_at: seconds(at(1, 9, 31)),
    sender: { id: 2, type: 'User', name: 'Mara' },
  },
  {
    ...base,
    id: 503,
    message_type: 2,
    content: 'Conversation was marked pending by Mara',
    created_at: seconds(at(1, 9, 32)),
  },
  {
    ...base,
    id: 504,
    message_type: 1,
    private: true,
    content: 'Carrier shows a scan in Leipzig on Monday.',
    created_at: seconds(at(0, 8, 40)),
    sender: { id: 2, type: 'User', name: 'Mara' },
  },
  {
    ...base,
    id: 505,
    message_type: 0,
    content: 'Danke, ich warte noch bis Freitag.',
    created_at: seconds(at(0, 9, 5)),
    sender: { id: 7, type: 'contact', name: 'Anna Keller' },
  },
];

const sent = {
  messageId: 502,
  cycleId: 12,
  version: 1,
  edited: false,
  author: 'model',
  sentBy: 'agent',
  trace: [
    { kind: 'tier', tier: 'draft', channel: 'email', refusal: null },
    { kind: 'policy' },
  ],
};

const timeline = [
  {
    kind: 'drafted',
    at: at(1, 9, 20).toISOString(),
    procedureTitle: 'Where is my order',
    version: 1,
  },
];

const sentDraftFor = id => (id === 502 ? sent : null);
</script>

<template>
  <div class="flex flex-col gap-6">
    <div>
      <p class="mb-2 text-xs text-n-slate-11">With the gateway</p>
      <MessageList
        :current-user-id="2"
        :messages="messages"
        :timeline="timeline"
        :sent-draft-for="sentDraftFor"
        channel-word="Email"
        class="rounded-lg border border-n-weak"
      />
    </div>
    <div>
      <p class="mb-2 text-xs text-n-slate-11">
        An old gateway: plain bylines, no Gotchu lines
      </p>
      <MessageList
        :current-user-id="2"
        :messages="messages"
        class="rounded-lg border border-n-weak"
      />
    </div>
  </div>
</template>
