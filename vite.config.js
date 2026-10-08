import { defineConfig } from 'vite';

/**
 * El entry usa top-level await (carga el dataset en runtime), por lo que el
 * target debe ser esnext en build y en la optimización de dependencias.
 */
const ESNEXT = 'esnext';

export default defineConfig({
  server: {
    port: 5273,
    strictPort: false,
    open: false,
  },
  esbuild: { target: ESNEXT },
  optimizeDeps: { esbuildOptions: { target: ESNEXT } },
  build: {
    target: ESNEXT,
    outDir: 'dist',
    sourcemap: true,
  },
});
