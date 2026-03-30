import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@contracts': path.resolve(__dirname, './contracts/src'),
    },
  },
  server: {
    proxy: {
      '/sui-rpc': {
        target: 'https://fullnode.devnet.sui.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/sui-rpc/, ''),
      },
    },
  },
});
