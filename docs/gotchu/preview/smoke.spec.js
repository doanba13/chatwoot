import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import { createRouter, createWebHashHistory } from 'vue-router';
import Gallery from './Gallery.vue';

import components from 'dashboard/i18n/locale/en/components.json';

// A compile is not a render. This mounts every re-themed primitive together and
// fails on a bad prop, a missing slot contract or a runtime error — the class of
// mistake that would otherwise only show up as a blank area in the browser.
describe('Gotchu preview gallery', () => {
  const mountGallery = () =>
    mount(Gallery, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: {
              en: {
                // The real catalogue, as main.js loads it: the AI surfaces
                // carry copy, and a bare instance would render their keys.
                ...components,
                SWITCH: { TOGGLE: 'Toggle' },
                BREADCRUMB: { ARIA_LABEL: 'Breadcrumb' },
              },
            },
          }),
          createRouter({
            history: createWebHashHistory(),
            routes: [
              { path: '/:catchAll(.*)', component: { render: () => null } },
            ],
          }),
        ],
      },
    });

  it('mounts every primitive without a runtime error', () => {
    const wrapper = mountGallery();
    expect(wrapper.exists()).toBe(true);
  });

  it('renders the content that goes through a slot rather than a prop', () => {
    // Banner takes a default slot and has no `content` prop — passing one
    // renders an empty banner, which is what this asserts against.
    const text = mountGallery().text();
    expect(text).toContain('Gotchu drafted a reply.');
    expect(text).toContain('The Shopify token expired.');
  });

  it('renders every table row, since the row slot is handed the whole array', () => {
    const text = mountGallery().text();
    expect(text).toContain('#PL-1095');
    expect(text).toContain('#CU-2213');
    expect(text).toContain('#GE-0447');
  });

  it('renders the identifier column in the mono face', () => {
    // BaseTable's identifier flag drives a scoped nth-child rule, so the only
    // thing assertable here is that the flag survived into the rendered table.
    const table = mountGallery().find('table');
    expect(table.attributes('data-identifier-columns')).toBeTruthy();
  });

  it('renders the AI surfaces against their real copy', () => {
    const text = mountGallery().text();

    // The trace summary is a plural assembled from the catalogue; a bare i18n
    // instance renders the keypath instead, which is the failure this catches.
    expect(text).toContain('Gotchu checked 3 things');
    expect(text).toContain('Gotchu checked 1 thing');
    expect(text).toContain('Draft from Gotchu');
    expect(text).toContain('check this');
  });

  it('renders a button for every colour and variant', () => {
    // 5 colours x 5 variants, plus 4 sizes, loading, disabled and the theme toggle.
    expect(mountGallery().findAll('button').length).toBeGreaterThanOrEqual(25);
  });
});
