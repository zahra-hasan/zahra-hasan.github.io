// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://zahra-hasan.github.io',
  trailingSlash: 'always',
  // Ship CSS inside each page: one less request before anything can be drawn.
  build: { inlineStylesheets: 'always' },
  integrations: [sitemap()],
  vite: {
    // Native modules used at build time for social images.
    ssr: { external: ['@resvg/resvg-js'] },
  },
});
