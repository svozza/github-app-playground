import type { Context } from 'aws-lambda';
import { metrics } from './metrics.ts';

const withMetrics = <T>(
  handler: (event: unknown, context: Context) => Promise<T>
) => {
  return async (event: unknown, context: Context): Promise<T> => {
    try {
      return await handler(event, context);
    } finally {
      metrics.publishStoredMetrics();
    }
  };
};

export { withMetrics };
