import { addUserAgentMiddleware } from '@aws-lambda-powertools/commons';
import { getStringFromEnv } from '@aws-lambda-powertools/commons/utils/env';
import {
  EventBridgeClient,
  PutEventsCommand,
} from '@aws-sdk/client-eventbridge';
import { z } from 'zod';

const eventBusName = getStringFromEnv({ key: 'EVENT_BUS_NAME' });
const eventBridgeClient = new EventBridgeClient({});
addUserAgentMiddleware(eventBridgeClient, 'github-app-playground');

const githubEventSchema = z.object({
  action: z.string(),
  repository: z.object({
    full_name: z.string(),
  }),
});

const repositoryIsAllowed = (repository: string, allowlist: string) => {
  const allowedRepositories = new Set(
    allowlist
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  );
  return allowedRepositories.has(repository.toLowerCase());
};

const publishEventToEventBridge = async (
  detailType: string,
  originalEvent: string
) => {
  const response = await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: 'github.com',
          DetailType: detailType,
          Detail: originalEvent,
        },
      ],
    })
  );

  if (response.FailedEntryCount) {
    throw new Error('EventBridge rejected the GitHub webhook event');
  }
};

export { githubEventSchema, publishEventToEventBridge, repositoryIsAllowed };
