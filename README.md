# GitHub App Playground

A minimal GitHub App skeleton for prototyping event-driven automation on AWS.

The initial target is a complete webhook round trip:

```text
GitHub webhook -> API Gateway -> Lambda -> EventBridge -> Lambda -> GitHub
```

The project will use AWS CDK, TypeScript, Lambda, EventBridge, DynamoDB, and the
GitHub App API. Its first feature will be a small pull request automation that
proves the app can receive a signed webhook and act through an installation
token.

The agentic bug-triage feature is intentionally out of scope for this initial
skeleton.
