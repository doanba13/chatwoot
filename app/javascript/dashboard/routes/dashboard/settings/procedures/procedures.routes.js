import { frontendURL } from 'dashboard/helper/URLHelper';

import SettingsWrapper from '../SettingsWrapper.vue';
import SettingsContent from '../Wrapper.vue';
import Index from './Index.vue';
import CreateProcedure from './CreateProcedure.vue';
import EditProcedure from './EditProcedure.vue';

// Administrators only, everywhere on this surface -- `Gotchu::
// ProceduresController` enforces it server-side, and the screen should not
// offer what the API will refuse (task 11 brief). No `featureFlag`: this is
// gated by the gateway's own `capabilities.procedures`, read at request
// time by Index.vue, not by a per-account rollout flag.
const ADMIN_ONLY = { permissions: ['administrator'] };

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/procedures'),
      component: SettingsWrapper,
      children: [
        {
          path: '',
          name: 'procedures_wrapper',
          meta: ADMIN_ONLY,
          redirect: to => {
            return { name: 'procedures_list', params: to.params };
          },
        },
        {
          path: 'list',
          name: 'procedures_list',
          meta: ADMIN_ONLY,
          component: Index,
        },
      ],
    },
    // A separate block, the way macros.routes.js splits its own list from its
    // editor: `SettingsContent` (`Wrapper.vue`) renders the back-button header
    // bar that a create/edit page wants and the list page does not.
    {
      path: frontendURL('accounts/:accountId/settings/procedures'),
      component: SettingsContent,
      props: () => {
        return {
          headerTitle: 'PROCEDURES_MGMT.HEADER',
          icon: 'i-lucide-list-checks',
          showBackButton: true,
        };
      },
      children: [
        {
          path: 'new',
          name: 'procedures_new',
          meta: ADMIN_ONLY,
          component: CreateProcedure,
        },
        {
          path: ':procedureId/edit',
          name: 'procedures_edit',
          meta: ADMIN_ONLY,
          component: EditProcedure,
        },
      ],
    },
  ],
};
