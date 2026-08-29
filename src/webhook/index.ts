import { getStringFromEnv } from '@aws-lambda-powertools/commons/utils/env';
import {
  IdempotencyConfig,
  makeIdempotent,
} from '@aws-lambda-powertools/idempotency';
import { DynamoDBPersistenceLayer } from '@aws-lambda-powertools/idempotency/dynamodb';
import { JSONStringified } from '@aws-lambda-powertools/parser/helpers';
import { APIGatewayProxyEventV2Schema } from '@aws-lambda-powertools/parser/schemas/api-gatewayv2';
import type { ParsedResult } from '@aws-lambda-powertools/parser/types';
import { logger } from '@github-app-playground/core/logger';
import { metrics } from '@github-app-playground/core/metrics';
import { withLogger } from '@github-app-playground/core/withLogger';
import { withMetrics } from '@github-app-playground/core/withMetrics';
import { withParser } from '@github-app-playground/core/withParser';
import type { Context } from 'aws-lambda';
import { z } from 'zod';
import { SignatureVerifier } from './SignatureVerifier.ts';
import {
  githubEventSchema,
  publishEventToEventBridge,
  repositoryIsAllowed,
} from './utils.ts';

logger.appendPersistentKeys({ feature: 'webhook' });

const persistenceStore = new DynamoDBPersistenceLayer({
  tableName: getStringFromEnv({ key: 'IDEMPOTENCY_TABLE_NAME' }),
});
const idempotencyConfig = new IdempotencyConfig({
  eventKeyJmesPath: 'data.headers."x-github-delivery"',
  expiresAfterSeconds: 60 * 60 * 2,
  throwOnNoIdempotencyKey: true,
  useLocalCache: true,
});
const repoAllowlist = getStringFromEnv({ key: 'REPO_ALLOWLIST' });
const signatureVerifier = new SignatureVerifier();

const webhookEventSchema = APIGatewayProxyEventV2Schema.extend({
  body: z.string(),
  headers: z
    .object({
      'x-github-delivery': z.string(),
      'x-github-event': z.string(),
      'x-hub-signature-256': z.string(),
    })
    .and(z.record(z.string(), z.string())),
});

const processWebhook = async (
  parsedResult: ParsedResult<unknown, z.infer<typeof webhookEventSchema>>,
  _context: Context
) => {
  if (!parsedResult.success) {
    logger.warn('Webhook payload did not match the expected shape', {
      error: parsedResult.error,
    });
    return { statusCode: 400, body: 'Invalid webhook payload' };
  }

  const event = parsedResult.data;
  if (
    !(await signatureVerifier.verify({
      data: event.body,
      headers: event.headers,
    }))
  ) {
    logger.warn('Webhook signature did not match');
    return { statusCode: 401, body: 'Invalid signature' };
  }

  const githubEvent = JSONStringified(githubEventSchema).safeParse(event.body);
  if (!githubEvent.success) {
    logger.warn('GitHub event did not match the expected shape', {
      error: githubEvent.error,
    });
    return { statusCode: 400, body: 'Unsupported GitHub event' };
  }

  if (
    !repositoryIsAllowed(githubEvent.data.repository.full_name, repoAllowlist)
  ) {
    logger.warn('Webhook repository is not allowlisted', {
      repository: githubEvent.data.repository.full_name,
    });
    return { statusCode: 403, body: 'Repository is not allowed' };
  }

  const eventType = event.headers['x-github-event'];
  const detailType = `${eventType}.${githubEvent.data.action}`;
  await publishEventToEventBridge(detailType, event.body);

  metrics.addMetric('WebhookEventProcessed', 'Count', 1);
  metrics.addMetric(
    'WebhookPayloadSize',
    'Bytes',
    Buffer.byteLength(event.body)
  );
  return { statusCode: 202, body: 'Accepted' };
};

const handler = withMetrics(
  withLogger(
    withParser(webhookEventSchema, { safeParse: true })(
      makeIdempotent(processWebhook, {
        config: idempotencyConfig,
        persistenceStore,
      })
    )
  )
);

export { handler };
