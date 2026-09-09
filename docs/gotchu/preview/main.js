import { createApp } from 'vue';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHashHistory } from 'vue-router';
import Gallery from './Gallery.vue';

import components from 'dashboard/i18n/locale/en/components.json';

// The real dashboard stylesheet, so what renders here is what renders in the
// app — Tailwind, _next-colors and the Gotchu token sheet in their real order.
import 'dashboard/assets/scss/app.scss';

// Self-hosted display and mono faces, as entrypoints/dashboard.js does it.
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/jetbrains-mono';

// Switch.vue calls useI18n(); a bare instance is enough to render it. The
// Gotchu surfaces carry real copy, so they get the real catalogue file rather
// than a hand-copied subset that would drift from it.
const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      ...components,
      SWITCH: { TOGGLE: 'Toggle' },
      BREADCRUMB: { ARIA_LABEL: 'Breadcrumb' },
    },
  },
});

// SidebarGroupLeaf renders a <router-link> whenever it is given a `to`, so it
// needs a router registered or it throws on mount. One catch-all route is
// enough — nothing here navigates.
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/:catchAll(.*)', component: { render: () => null } }],
});

createApp(Gallery).use(i18n).use(router).mount('#app');
