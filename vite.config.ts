import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const token = env.VITE_CF_BEACON_TOKEN ?? '';
  return {
    plugins: [
      react(),
      {
        name: 'cf-beacon',
        transformIndexHtml() {
          if (!token) return [];
          return [{
            tag: 'script',
            injectTo: 'head' as const,
            attrs: {
              defer: true,
              src: 'https://static.cloudflareinsights.com/beacon.min.js',
              'data-cf-beacon': JSON.stringify({ token }),
            },
          }];
        },
      },
    ],
    test: { include: ['src/**/*.test.ts'] },
  };
});
