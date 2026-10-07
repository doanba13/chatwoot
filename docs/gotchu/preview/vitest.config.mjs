import path from 'path';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Runs the preview's smoke mount only. Separate from the repo's vitest.config.ts
// because that one scopes `include` to app/**, and this harness deliberately
// lives outside app/ — nothing shipped should import it.
export default defineConfig({
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
      widget: path.resolve('./app/javascript/widget'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['docs/gotchu/preview/*.spec.js'],
    globals: true,
  },
});
