import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': `${root}src`,
      // 'server-only' wirft ausserhalb des RSC-Bundlers – in Tests ein Stub.
      'server-only': `${root}test/stubs/server-only.ts`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['test/setup-env.ts'],
  },
})
