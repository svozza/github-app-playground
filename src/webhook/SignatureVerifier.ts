import { subtle, type webcrypto } from 'node:crypto';
import { getStringFromEnv } from '@aws-lambda-powertools/commons/utils/env';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import type { APIGatewayProxyEventV2 } from '@aws-lambda-powertools/parser/types';

interface VerifyOptions {
  data: string;
  headers: APIGatewayProxyEventV2['headers'];
}

class SignatureVerifier {
  readonly #algorithm = { name: 'HMAC', hash: { name: 'SHA-256' } };
  readonly #encoder = new TextEncoder();
  readonly #secretName: string;
  #key?: webcrypto.CryptoKey;

  public constructor() {
    this.#secretName = getStringFromEnv({ key: 'WEBHOOK_SECRET_NAME' });
  }

  async #getKey() {
    if (!this.#key) {
      const secret = await getSecret<string>(this.#secretName);
      if (!secret) {
        throw new Error('Webhook secret was not found in Secrets Manager');
      }
      this.#key = await subtle.importKey(
        'raw',
        this.#encoder.encode(secret),
        this.#algorithm,
        false,
        ['verify']
      );
    }
    return this.#key;
  }

  public async verify({ data, headers }: VerifyOptions) {
    const signatureHeader = headers?.['x-hub-signature-256'];
    if (!signatureHeader?.startsWith('sha256=')) {
      throw new Error('Valid x-hub-signature-256 header is required');
    }

    const signature = Buffer.from(
      signatureHeader.slice('sha256='.length),
      'hex'
    );
    if (signature.length !== 32) {
      throw new Error('Webhook signature has an invalid length');
    }

    return subtle.verify(
      'HMAC',
      await this.#getKey(),
      signature,
      this.#encoder.encode(data)
    );
  }
}

export { SignatureVerifier };
