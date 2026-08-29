import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSecret: vi.fn(),
}));

vi.mock('@aws-lambda-powertools/parameters/secrets', () => ({
  getSecret: mocks.getSecret,
}));

describe('SignatureVerifier', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('WEBHOOK_SECRET_NAME', 'test-webhook-secret');
    mocks.getSecret.mockReset();
    mocks.getSecret.mockResolvedValue('secret');
  });

  it('accepts a valid sha256 signature', async () => {
    const { SignatureVerifier } = await import('./SignatureVerifier.ts');
    const body = '{"action":"opened"}';
    const signature = createHmac('sha256', 'secret').update(body).digest('hex');

    await expect(
      new SignatureVerifier().verify({
        data: body,
        headers: {
          'x-hub-signature-256': `sha256=${signature}`,
        },
      })
    ).resolves.toBe(true);
  });

  it('rejects an invalid signature', async () => {
    const { SignatureVerifier } = await import('./SignatureVerifier.ts');

    await expect(
      new SignatureVerifier().verify({
        data: '{}',
        headers: {
          'x-hub-signature-256': `sha256=${'0'.repeat(64)}`,
        },
      })
    ).resolves.toBe(false);
  });

  it('rejects a malformed signature header', async () => {
    const { SignatureVerifier } = await import('./SignatureVerifier.ts');

    await expect(
      new SignatureVerifier().verify({
        data: '{}',
        headers: {},
      })
    ).rejects.toThrow('Valid x-hub-signature-256 header is required');
  });
});
