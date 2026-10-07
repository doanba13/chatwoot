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
 *
 * `draftKey` is the dock's "cycleId:version" (draftMeta): a change within one
 * conversation re-reads, so "drafted"/"redrafted" lines and a sent draft's
 * byline appear without waiting for another outgoing message. `annotatedFor`
 * is the conversation whose first read has landed, so the thread can re-scroll
 * once the lines it added are in the DOM.
 */
export const useThreadAnnotations = ({
  conversationId,
  messages,
  threadRoutes,
  draftKey,
}) => {
  const sentDrafts = ref([]);
  const timeline = ref([]);
  const annotatedFor = ref(null);
  let timer = null;
  let seq = 0;

  const byMessage = computed(
    () => new Map(sentDrafts.value.map(d => [String(d.messageId), d]))
  );
  const sentDraftFor = messageId =>
    byMessage.value.get(String(messageId)) ?? null;

  const load = async () => {
    const id = unref(conversationId);
    if (id == null || unref(threadRoutes) === false) return;
    seq += 1;
    const mine = seq;
    try {
      const { data } = await ThreadAPI.get(id);
      // Only the newest read may write: covers a switch away and back too.
      if (mine !== seq) return;
      setDraftMeta(id, { threadAvailable: data?.available === true });
      const on = data?.available === true;
      sentDrafts.value = on ? data.sentDrafts || [] : [];
      timeline.value = on ? data.timeline || [] : [];
      annotatedFor.value = id;
    } catch (e) {
      // A gateway that is down is not a gateway without the feature.
    }
  };

  watch(
    conversationId,
    () => {
      clearTimeout(timer);
      seq += 1; // an in-flight read of the previous conversation is stale
      sentDrafts.value = [];
      timeline.value = [];
      annotatedFor.value = null;
      load();
    },
    { immediate: true }
  );

  const refetchSoon = () => {
    clearTimeout(timer);
    timer = setTimeout(load, REFETCH_DELAY_MS);
  };

  watch(
    () => outgoingOrActivity(messages),
    (now, before) => {
      if (now > before) refetchSoon();
    }
  );

  // Not the dock's first read (before == null), and not a switch: the
  // conversation watcher above has already read that one.
  watch(
    () => [unref(conversationId), unref(draftKey)],
    ([id, key], [idBefore, keyBefore]) => {
      if (id !== idBefore || key == null || keyBefore == null) return;
      if (key !== keyBefore) refetchSoon();
    }
  );

  onBeforeUnmount(() => clearTimeout(timer));

  return { sentDraftFor, timeline, annotatedFor };
};
