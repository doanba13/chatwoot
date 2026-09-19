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

  it('renders the dock in every state the composer can show it', () => {
    const text = mountGallery().text();

    // The review window is built from `Date.now()` at load, so these prove the
    // labels are computed rather than frozen into the fixture.
    expect(text).toContain('18 min to review');
    expect(text).toContain('3 h to review');
    expect(text).toContain('review time ran out');
  });

  it('renders the composer placement rather than a panel section', () => {
    const wrapper = mountGallery();

    // The dock's own bottom border is its separator from the editor under it,
    // which is the whole reason it is drawn — the panel wrapper that nulled it is
    // gone, and so is the panel.
    expect(wrapper.find('.draft-dock').classes()).toContain('border-b');
    expect(wrapper.text()).toContain('The reply box goes here.');
    expect(wrapper.text()).not.toContain('No draft for this conversation.');
  });

  it('shows the capped long draft and the streaming loader', () => {
    // Both are things you can only judge by looking, so the gallery has to carry
    // them: an 812-character draft is what the 170px cap was chosen against, and
    // the loader is a state the replay above only passes through.
    const wrapper = mountGallery();

    const capped = wrapper
      .findAll('.draft-dock__body')
      .filter(body => body.text().length > 700);
    expect(capped).toHaveLength(1);
    expect(capped[0].classes()).toContain('max-h-[170px]');

    // Not a total count: the replay card starts in `streaming` too, so there are
    // two loaders on the page and the second one is the point of the fixed card.
    const loaders = wrapper.findAll('.draft-dock__loader');
    expect(loaders.length).toBeGreaterThanOrEqual(1);
    loaders.forEach(loader =>
      expect(loader.findAll('.draft-dock__dot')).toHaveLength(3)
    );
  });

  it('renders a failed read as a line rather than as silence', () => {
    // Every ordinary empty case renders nothing above the editor. A read that
    // failed must not, or it is indistinguishable from "no draft".
    const text = mountGallery().text();

    expect(text).toContain('Gotchu is not answering');
    expect(text).toContain('not configured on this Chatwoot');
  });

  it('renders a button for every colour and variant', () => {
    // 5 colours x 5 variants, plus 4 sizes, loading, disabled and the theme toggle.
    expect(mountGallery().findAll('button').length).toBeGreaterThanOrEqual(25);
  });
});
