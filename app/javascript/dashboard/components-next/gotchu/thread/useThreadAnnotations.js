import { computed, onBeforeUnmount, ref, unref, watch } from 'vue';
import ThreadAPI from 'dashboard/api/gotchu/thread';
import { setDraftMeta } from '../helpers/draftMeta';

const REFETCH_DELAY_MS = 1500;

// MessagesView hands over snake_case rows; the store holds camelCase.
const typeOf = message => message.messageType ?? message.message_type;
const outgoingOrActivity = messages =>
  (unref(messages) || []).filter(m => typeOf(m) === 1 || typeOf(m) === 2)
    .length;

/**
 * The gateway's annotations for the open conversation: which replies came from
 * a draft, and the timeline of Gotchu's own events. Every failure, and a
 * gateway without the routes, leaves them empty and says nothing.
 */
export const useThreadAnnotations = ({
  conversationId,
  messages,
  threadRoutes,
}) => {
  const sentDrafts = ref([]);
  const timeline = ref([]);
  let timer = null;

  const byMessage = computed(
    () => new Map(sentDrafts.value.map(d => [String(d.messageId), d]))
  );
  const sentDraftFor = messageId =>
    byMessage.value.get(String(messageId)) ?? null;

  const load = async () => {
    const id = unref(conversationId);
    if (unref(threadRoutes) === false) return;
    try {
      const { data } = await ThreadAPI.get(id);
      if (unref(conversationId) !== id) return;
      setDraftMeta(id, { threadAvailable: data?.available === true });
      const on = data?.available === true;
      sentDrafts.value = on ? data.sentDrafts || [] : [];
      timeline.value = on ? data.timeline || [] : [];
    } catch (e) {
      // A gateway that is down is not a gateway without the feature.
    }
  };

  watch(
    conversationId,
    () => {
      sentDrafts.value = [];
      timeline.value = [];
      load();
    },
    { immediate: true }
  );

  watch(
    () => outgoingOrActivity(messages),
    (now, before) => {
      if (now <= before) return;
      clearTimeout(timer);
      timer = setTimeout(load, REFETCH_DELAY_MS);
    }
  );

  onBeforeUnmount(() => clearTimeout(timer));

  return { sentDraftFor, timeline };
};
