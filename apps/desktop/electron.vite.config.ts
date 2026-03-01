import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['@ai-filmstudio/shared'],
      },
    },
  },
  preload: {
    build: {
      externalizeDeps: {
        exclude: ['@ai-filmstudio/shared'],
      },
      rollupOptions: {
        output: {
          format: 'cjs',
          entryFileNames: '[name].cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react()],
  },
});
