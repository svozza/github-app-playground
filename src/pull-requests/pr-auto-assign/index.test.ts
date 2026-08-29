import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Context } from 'aws-lambda';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
}));

vi.mock('@github-app-playground/core/github/appClient', () => ({
  githubApp: {
    getInstallationClient: async () => ({
      request: mocks.request,
    }),
  },
}));

import { handler } from './index.ts';

const event = JSON.parse(
  readFileSync(
    join(import.meta.dirname, 'events', 'pull_request.opened.json'),
    'utf8'
  )
);

describe('pr-auto-assign handler', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('assigns the pull request to its author', async () => {
    mocks.request.mockResolvedValue({});

    await handler(event, {} as Context);

    expect(mocks.request).toHaveBeenCalledWith(
      'POST /repos/{owner}/{repo}/issues/{issue_number}/assignees',
      {
        owner: 'svozza',
        repo: 'github-app-playground',
        issue_number: 1,
        assignees: ['svozza'],
      }
    );
  });

  it('allows retry for unexpected GitHub failures', async () => {
    mocks.request.mockRejectedValue(new Error('GitHub unavailable'));

    await expect(handler(event, {} as Context)).rejects.toThrow(
      'GitHub unavailable'
    );
  });
});
