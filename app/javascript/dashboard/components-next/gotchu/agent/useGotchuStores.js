// One instance per page: the narrow store list (GET gotchu/stores).
import { ref } from 'vue';
import StoresAPI from 'dashboard/api/gotchu/stores';

// --g-store-1..5 by position, the order the rail already uses. Pure, so the
// header can colour its dot from the same list without a second derivation.
export const storeIndexIn = (stores, key) => {
  const i = (stores ?? []).findIndex(s => s.key === key);
  return i === -1 ? null : (i % 5) + 1;
};

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

  const storeIndex = key => storeIndexIn(stores.value, key);

  return { stores, inboxes, storeIndex, isLoading, load };
}
