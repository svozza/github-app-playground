import { describe, expect, it } from 'vitest';
import { repositoryIsAllowed } from './utils.ts';

describe('repositoryIsAllowed', () => {
  it('matches trimmed repository names case-insensitively', () => {
    expect(
      repositoryIsAllowed(
        'svozza/github-app-playground',
        ' other/repo, SVOZZA/GITHUB-APP-PLAYGROUND '
      )
    ).toBe(true);
  });

  it('rejects repositories outside the allowlist', () => {
    expect(
      repositoryIsAllowed('someone/fork', 'svozza/github-app-playground')
    ).toBe(false);
  });
});
