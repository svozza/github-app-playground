# GitHub App Playground

A minimal GitHub App skeleton for prototyping event-driven automation on AWS.

```text
GitHub webhook -> API Gateway -> Lambda -> EventBridge -> Lambda -> GitHub
```

The first feature assigns a newly opened pull request to its author. It proves
the complete path from a signed webhook to an authenticated GitHub write made
under the App's identity.

## Architecture

- An API Gateway HTTP API receives GitHub webhooks.
- A Lambda validates the payload and HMAC signature, deduplicates deliveries in
  DynamoDB, checks the repository allowlist, and publishes the raw event to
  EventBridge.
- An EventBridge rule selects human-authored `pull_request.opened` events.
- A second Lambda creates an installation-scoped Octokit client and assigns the
  pull request to its author.
- AWS Lambda Powertools provides parsing, logging, metrics, and idempotency.

All resources are defined with AWS CDK and suffixed by environment.

## Local Development

Requires Node.js 24 and npm.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run synth
```

## Configuration

The stack imports configuration instead of creating credentials. For the
default `dev` environment it expects:

| Store | Name | Value |
| --- | --- | --- |
| Secrets Manager | `dev/github/apps/GitHubAppPlayground` | `{"appId":123,"privateKey":"-----BEGIN RSA PRIVATE KEY-----\n..."}` |
| Secrets Manager | `dev/github/hooks/GitHubAppPlayground` | The GitHub App webhook secret |
| SSM Parameter Store | `/dev/github/apps/GitHubAppPlayground/allowlist` | Comma-separated `owner/repo` names |

Override the environment with `-c environment=<name>`.

## Deploy

Bootstrap the target account and region once, then deploy:

```bash
npx cdk bootstrap aws://ACCOUNT_ID/REGION
npm run deploy
```

The stack output named `WebhookUrl` is the URL to configure in the GitHub App.
See [docs/setup.md](docs/setup.md) for the complete manual setup and
verification sequence.

## Scope

This repository is intentionally limited to the GitHub App plumbing and one
small feature. The agentic bug-triage feature is out of scope.
