import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({
  persistentKeys: {
    appVersion: process.env.APP_VERSION,
  },
});

export { logger };
