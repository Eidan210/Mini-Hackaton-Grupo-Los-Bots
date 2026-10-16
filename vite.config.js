import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// El frontend vive en /web; el backend Express (puerto 3001) sirve /api.
export default defineConfig({
  root: 'web',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../dist', emptyOutDir: true },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
