// One instance per page: the narrow store list (GET gotchu/stores).
import { ref } from 'vue';
import StoresAPI from 'dashboard/api/gotchu/stores';

export function useGotchuStores() {
  const stores = ref([]);
  const inboxes = ref([]);
  const isLoading = ref(false);

  const load = async () => {
    isLoading.value = true;
    try {
      const { data } = await StoresAPI.list();
      stores.value = data.stores ?? [];
      inboxes.value = data.inboxes ?? [];
    } finally {
      isLoading.value = false;
    }
  };

  // --g-store-1..5 by position, the order the rail already uses.
  const storeIndex = key => {
    const i = stores.value.findIndex(s => s.key === key);
    return i === -1 ? null : (i % 5) + 1;
  };

  return { stores, inboxes, storeIndex, isLoading, load };
}
