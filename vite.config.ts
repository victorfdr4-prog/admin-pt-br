import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production';

  return {
    // 🔥 FUNCIONA COM /admin EM PROD E LOCAL NORMAL
    base: isProd ? '/admin/' : '/',

    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      host: true,
      port: 5173,
      strictPort: true,
    },

    preview: {
      port: 5173,
      strictPort: true,
    },

    build: {
      sourcemap: !isProd,

      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return 'vendor';
            }
          },
        },
      },

      chunkSizeWarningLimit: 1000,
    },

    define: {
      __DEV__: !isProd,
    },
  };
});