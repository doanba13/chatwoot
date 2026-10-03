import { createRouter, createMemoryHistory } from 'vue-router';
import dashboardRoutes from 'dashboard/routes/dashboard/dashboard.routes';
import {
  ROLES,
  CONVERSATION_PERMISSIONS,
  PORTAL_PERMISSIONS,
} from 'dashboard/constants/permissions';
import { validateLoggedInRoutes } from 'dashboard/helper/routeHelpers';
import { HIDDEN_FEATURE_FLAGS, isHiddenRoute } from '../hiddenFeatures';

// Some route components import the router itself; a stub breaks that cycle.
vi.mock('dashboard/routes', () => ({ default: {} }));

const router = createRouter({
  history: createMemoryHistory(),
  routes: dashboardRoutes.routes,
});

const user = {
  accounts: [
    {
      id: 1,
      role: 'administrator',
      status: 'active',
      permissions: [...ROLES, ...CONVERSATION_PERMISSIONS, PORTAL_PERMISSIONS],
    },
  ],
};
const redirectFor = path => {
  const to = router.resolve(path);
  return validateLoggedInRoutes(to, user);
};

describe('hidden paid features', () => {
  it.each([
    ['custom roles', '/app/accounts/1/settings/custom-roles/list'],
    ['SLA', '/app/accounts/1/settings/sla/list'],
    ['captain', '/app/accounts/1/captain/assistants'],
    ['a captain page', '/app/accounts/1/captain/1/overview'],
    ['captain settings', '/app/accounts/1/settings/captain'],
    ['audit logs', '/app/accounts/1/settings/audit-logs/list'],
  ])('sends %s back to the dashboard', (_, path) => {
    expect(isHiddenRoute(router.resolve(path))).toBe(true);
    expect(redirectFor(path)).toBe('accounts/1/dashboard');
  });

  it.each([
    ['a help center route', '/app/accounts/1/portals/new'],
    ['a settings page with no flag', '/app/accounts/1/settings/general'],
    ['the queue route', '/app/accounts/1/queue/mine'],
  ])('leaves %s alone', (_, path) => {
    const to = router.resolve(path);
    expect(to.matched.length).toBeGreaterThan(0);
    expect(isHiddenRoute(to)).toBe(false);
    expect(redirectFor(path)).not.toBe('accounts/1/dashboard');
  });

  it('never hides help center', () => {
    expect(HIDDEN_FEATURE_FLAGS).not.toContain('help_center');
  });
});
