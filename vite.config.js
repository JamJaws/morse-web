import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    build: {
      outDir: 'build',
    },
    server: {
      proxy: { '/beep': { target: 'http://127.0.0.1:8080', ws: true } },
    },
    plugins: [react()],
  };
});
