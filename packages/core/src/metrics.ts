import { Metrics } from '@aws-lambda-powertools/metrics';

const metrics = new Metrics({
  namespace: 'GitHubAppPlayground',
  defaultDimensions: process.env.APP_VERSION
    ? { appVersion: process.env.APP_VERSION }
    : {},
});

export { metrics };
