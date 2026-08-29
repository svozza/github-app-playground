import { EventBridgeSchema } from '@aws-lambda-powertools/parser/schemas/eventbridge';
import { githubApp } from '@github-app-playground/core/github/appClient';
import { logger } from '@github-app-playground/core/logger';
import { withLogger } from '@github-app-playground/core/withLogger';
import { withParser } from '@github-app-playground/core/withParser';
import { z } from 'zod';
import { FEATURE_NAME } from './constants.ts';

logger.appendPersistentKeys({ feature: FEATURE_NAME });

const pullRequestOpenedSchema = EventBridgeSchema.extend({
  'detail-type': z.literal('pull_request.opened'),
  detail: z.object({
    installation: z.object({
      id: z.number(),
    }),
    repository: z.object({
      name: z.string(),
      owner: z.object({
        login: z.string(),
      }),
    }),
    pull_request: z.object({
      number: z.number(),
      user: z.object({
        login: z.string(),
      }),
    }),
  }),
});

const handler = withLogger(
  withParser(pullRequestOpenedSchema)(async (event) => {
    const installationId = event.detail.installation.id;
    const owner = event.detail.repository.owner.login;
    const repo = event.detail.repository.name;
    const issueNumber = event.detail.pull_request.number;
    const author = event.detail.pull_request.user.login;

    logger.appendKeys({
      eventId: event.id,
      eventType: event['detail-type'],
      installationId,
      pullRequest: {
        author,
        number: issueNumber,
        repository: `${owner}/${repo}`,
      },
    });

    const githubClient = await githubApp.getInstallationClient(installationId);

    try {
      await githubClient.request(
        'POST /repos/{owner}/{repo}/issues/{issue_number}/assignees',
        {
          owner,
          repo,
          issue_number: issueNumber,
          assignees: [author],
        }
      );
      logger.info('Pull request assigned to its author');
    } catch (error) {
      if (
        error instanceof Error &&
        'status' in error &&
        (error.status === 403 || error.status === 422)
      ) {
        logger.warn('Pull request author could not be assigned', { error });
        return;
      }
      throw error;
    }
  })
);

export { handler, pullRequestOpenedSchema };
