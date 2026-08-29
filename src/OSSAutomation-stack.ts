#!/usr/bin/env node
import 'source-map-support/register.js';
import { readFileSync } from 'node:fs';
import { App, CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import { EventBus } from 'aws-cdk-lib/aws-events';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import { StringParameter } from 'aws-cdk-lib/aws-ssm';
import type { Construct } from 'constructs';
import { PrAutoAssignHandler } from './pull-requests/pr-auto-assign/resources.ts';
import { WebhookConstruct } from './webhook/resources.ts';

const app = new App();

class OSSAutomationStack extends Stack {
  public constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      version: string;
    };
    this.node.setContext('appVersion', packageJson.version);

    const environment = this.node.getContext('environment') as string;
    const appInfoSecret = Secret.fromSecretNameV2(
      this,
      'app-info-secret',
      `${environment}/github/apps/GitHubAppPlayground`
    );
    const repoAllowlist = StringParameter.fromStringParameterName(
      this,
      'repo-allowlist',
      `/${environment}/github/apps/GitHubAppPlayground/allowlist`
    );
    const eventBus = new EventBus(this, 'event-bus', {
      eventBusName: `github-app-playground-events-${environment}`,
    });

    eventBus.archive('event-bus-archive', {
      archiveName: `github-app-playground-events-${environment}`,
      eventPattern: { source: ['github.com'] },
      retention: Duration.days(7),
    });

    const webhook = new WebhookConstruct(this, 'webhook', {
      eventBus,
      repoAllowlist,
    });
    new PrAutoAssignHandler(this, 'pr-auto-assign', {
      appInfoSecret,
      eventBus,
    });

    new CfnOutput(this, 'WebhookUrl', {
      description: 'Set this as the GitHub App webhook URL',
      value: webhook.api.apiEndpoint,
    });
  }
}

new OSSAutomationStack(app, 'GitHubAppPlayground', {
  tags: {
    Service: 'GitHubAppPlayground',
  },
});
