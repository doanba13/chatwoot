import { frontendURL } from 'dashboard/helper/URLHelper';

import SettingsWrapper from '../SettingsWrapper.vue';
import Index from './Index.vue';

// Administrators only: Gotchu::StoreRoutesController enforces it server-side,
// and the screen should not offer what the API will refuse.
//
// Route name and shell are `gotchu_stores_index` / `Index.vue`, not the
// simpler `gotchu_stores` / `GotchuStores.vue` this task's own brief used --
// preflight.md A8 reconciled this task against sub-item 4 (the Shopify OAuth
// work), which already hard-codes `gotchu_stores_index` as the page its
// connect-a-store callback and sidebar entry land on, and mounts its own
// `<ShopifyStores />` at the top of this same `Index.vue`. This task's own
// mapping UI lives in the sibling `InboxMapping.vue`, mounted below where
// that future component will go.
const ADMIN_ONLY = { permissions: ['administrator'] };

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/gotchu-stores'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'gotchu_stores_index',
          meta: ADMIN_ONLY,
          component: Index,
        },
      ],
    },
  ],
};
