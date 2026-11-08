import { defineConfig } from 'vitest/config';

// Separate from the main vitest.config.ts (which only picks up src/**/*.spec.ts)
// so `npm run test` never accidentally runs the contract suite, and vice versa —
// invoke with `vitest run --config contract/vitest.config.ts` from the package root.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['contract/**/*.test.ts'],
  },
});
