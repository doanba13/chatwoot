import { ref, watch, onUnmounted } from 'vue';
import ContextAPI from 'dashboard/api/gotchu/context';

// The drawer's read of the gateway's PanelContext, through the Rails proxy.
// `state` says why there is no context, so the drawer never renders nothing:
// 503 is "not set up on this desk", anything else "did not answer".
export function useOrderContext(conversationIdRef) {
  const context = ref(null);
  const state = ref('loading');
  const refreshing = ref(false);
  let seq = 0;

  const failureState = error =>
    error?.response?.status === 503 ? 'unconfigured' : 'unavailable';

  const read = async ({ refresh }) => {
    const id = conversationIdRef.value;
    seq += 1;
    const mine = seq;
    try {
      const { data } = await ContextAPI.get(id, { refresh });
      // A newer read, or another conversation, has taken over: drop this one.
      if (mine !== seq) return;
      context.value = data;
      state.value = 'ready';
    } catch (error) {
      if (mine !== seq) return;
      // A failed Refresh keeps what the agent was already looking at.
      if (refresh && context.value) return;
      context.value = null;
      state.value = failureState(error);
    } finally {
      if (mine === seq) refreshing.value = false;
    }
  };

  const load = () => {
    context.value = null;
    state.value = 'loading';
    refreshing.value = false;
    return read({ refresh: false });
  };

  const refresh = () => {
    if (refreshing.value) return Promise.resolve();
    refreshing.value = true;
    return read({ refresh: true });
  };

  watch(conversationIdRef, load, { immediate: true });
  onUnmounted(() => {
    seq += 1;
  });

  return { context, state, refreshing, refresh };
}
