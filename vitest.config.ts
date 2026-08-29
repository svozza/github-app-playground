import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    env: {
      EVENT_BUS_NAME: 'test-event-bus',
      IDEMPOTENCY_TABLE_NAME: 'test-idempotency-table',
      REPO_ALLOWLIST: 'svozza/github-app-playground',
      WEBHOOK_SECRET_NAME: 'test-webhook-secret',
    },
    coverage: {
      provider: 'v8',
      include: ['packages/core/src/**/*.ts', 'src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/resources.ts',
        'src/OSSAutomation-stack.ts',
      ],
    },
  },
});
