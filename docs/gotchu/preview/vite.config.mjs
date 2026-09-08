import path from 'path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// Standalone preview harness for the Gotchu design pass.
//
// Why this exists: `pnpm story:build` and `story:dev` are broken on this fork
// and were broken before this branch — histoire 0.17 / vite-node 0.34 / mlly
// mis-resolve `@babel/runtime`'s exports wildcard under pnpm's layout, and it
// dies during story collection before Vite compiles anything. Verified by
// running it on `develop`, where it fails identically. So there was no way to
// look at a re-themed component, which for a design change is the check that
// matters most.
//
// Run it from the REPO ROOT (the aliases below are cwd-relative, matching
// vite.shared.ts):
//
//   pnpm exec vite --config docs/gotchu/preview/vite.config.mjs
//
// This is a development aid, not part of any build. Nothing in app/ imports it.
export default defineConfig({
  root: path.resolve('./docs/gotchu/preview'),
  plugins: [vue()],
  resolve: {
    alias: {
      vue: 'vue/dist/vue.esm-bundler.js',
      components: path.resolve('./app/javascript/dashboard/components'),
      next: path.resolve('./app/javascript/dashboard/components-next'),
      dashboard: path.resolve('./app/javascript/dashboard'),
      helpers: path.resolve('./app/javascript/shared/helpers'),
      shared: path.resolve('./app/javascript/shared'),
      assets: path.resolve('./app/javascript/dashboard/assets'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
        // `_woot.scss` reaches for `shared/assets/fonts/...` and `next-colors`
        // by bare path, which resolve against these rather than relatively.
        loadPaths: [
          path.resolve('./app/javascript'),
          path.resolve('./app/javascript/dashboard/assets/scss'),
          path.resolve('./node_modules'),
        ],
      },
    },
  },
  server: { port: 5199, open: false },
});
