import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: '',
    rollupOptions: {
      input: {
        main: './index.html',
        viewer: './src/viewer.html'
      }
    }
  },
  base: './',
  server: {
    port: 3000,
  },
});
