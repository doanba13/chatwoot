import { frontendURL } from 'dashboard/helper/URLHelper';

// The procedure screens moved under Agent (agent-screens plan, Task A4).
// These keep the old settings URLs and route names alive as redirects, so
// existing links and bookmarks still land on the new pages.
const ADMIN_ONLY = { permissions: ['administrator'] };
const to = name => route => ({ name, params: route.params });

export default {
  routes: [
    {
      path: frontendURL('accounts/:accountId/settings/procedures'),
      name: 'procedures_wrapper',
      meta: ADMIN_ONLY,
      redirect: to('agent_procedures'),
    },
    {
      path: frontendURL('accounts/:accountId/settings/procedures/list'),
      name: 'procedures_list',
      meta: ADMIN_ONLY,
      redirect: to('agent_procedures'),
    },
    {
      path: frontendURL('accounts/:accountId/settings/procedures/new'),
      name: 'procedures_new',
      meta: ADMIN_ONLY,
      redirect: to('agent_procedure_new'),
    },
    {
      path: frontendURL(
        'accounts/:accountId/settings/procedures/:procedureId/edit'
      ),
      name: 'procedures_edit',
      meta: ADMIN_ONLY,
      redirect: to('agent_procedure'),
    },
  ],
};
