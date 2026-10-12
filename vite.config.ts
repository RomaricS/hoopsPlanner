import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    rollupOptions: { input: { main: 'index.html', proto3d: 'proto3d.html', painted: 'painted.html' } },
    chunkSizeWarningLimit: 2000,
  },
});
