import type { Context } from 'aws-lambda';
import { logger } from './logger.ts';

const withLogger = <T>(
  handler: (event: unknown, context: Context) => Promise<T>
) => {
  return async (event: unknown, context: Context): Promise<T> => {
    logger.addContext(context);
    logger.logEventIfEnabled(event);

    try {
      return await handler(event, context);
    } finally {
      logger.resetKeys();
    }
  };
};

export { withLogger };
