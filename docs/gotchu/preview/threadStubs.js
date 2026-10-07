import { createStore } from 'vuex';

// The thread mounts the real Message, which reaches for the Vuex store and two
// app-wide directives. The gallery has no app, so this is the least that lets
// it render: an empty store and directives that draw nothing extra.
export const threadStubs = {
  install(app) {
    app.use(
      createStore({
        getters: {
          getSelectedChat: () => null,
          'inboxes/getInbox': () => () => ({}),
          'globalConfig/isOnChatwootCloud': () => false,
          'globalConfig/get': () => ({}),
        },
      })
    );
    app.directive('tooltip', {});
    app.directive('dompurify-html', {
      mounted: (el, { value }) => {
        el.innerHTML = value;
      },
    });
  },
};
