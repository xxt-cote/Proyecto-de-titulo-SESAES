import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Evita agotar la memoria al abrir un worker por núcleo en equipos grandes.
    maxWorkers: 1
  }
});
