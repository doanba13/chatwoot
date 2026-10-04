import { frontendURL } from 'dashboard/helper/URLHelper';

// The Agent section (agent-screens plan, decision 1): every signed-in agent
// reads these pages. Writes are refused per action, server-side, and each
// editor renders read-only for an agent who is not an administrator.
const EVERY_AGENT = { permissions: ['administrator', 'agent'] };
const page = loader => ({ component: loader, meta: EVERY_AGENT });

export const routes = [
  {
    path: frontendURL('accounts/:accountId/agent'),
    name: 'agent_home',
    meta: EVERY_AGENT,
    redirect: to => ({ name: 'agent_overview', params: to.params }),
  },
  {
    path: frontendURL('accounts/:accountId/agent/overview'),
    name: 'agent_overview',
    ...page(() => import('./overview/AgentOverview.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/procedures'),
    name: 'agent_procedures',
    ...page(() => import('./procedures/ProcedureList.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/procedures/new'),
    name: 'agent_procedure_new',
    ...page(() => import('./procedures/ProcedureEditor.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/procedures/:procedureId'),
    name: 'agent_procedure',
    ...page(() => import('./procedures/ProcedureEditor.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/rules'),
    name: 'agent_rules',
    ...page(() => import('./rules/RuleList.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/rules/new'),
    name: 'agent_rule_new',
    ...page(() => import('./rules/RuleEditor.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/rules/:ruleId'),
    name: 'agent_rule',
    ...page(() => import('./rules/RuleEditor.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/memos'),
    name: 'agent_memos',
    ...page(() => import('./memos/MemoList.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/memos/new'),
    name: 'agent_memo_new',
    ...page(() => import('./memos/MemoEditor.vue')),
  },
  {
    path: frontendURL('accounts/:accountId/agent/memos/:memoId'),
    name: 'agent_memo',
    ...page(() => import('./memos/MemoEditor.vue')),
  },
];
