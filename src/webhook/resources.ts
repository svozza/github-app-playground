import { join } from 'node:path';
import { RemovalPolicy } from 'aws-cdk-lib';
import { HttpApi } from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { AttributeType, Billing, TableV2 } from 'aws-cdk-lib/aws-dynamodb';
import type { EventBus } from 'aws-cdk-lib/aws-events';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';
import type { IStringParameter } from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import { FunctionConstruct } from '../shared-resources.ts';

interface WebhookConstructProps {
  eventBus: EventBus;
  repoAllowlist: IStringParameter;
}

class WebhookConstruct extends Construct {
  public readonly api: HttpApi;

  public constructor(
    scope: Construct,
    id: string,
    props: WebhookConstructProps
  ) {
    super(scope, id);

    const environment = this.node.getContext('environment');
    const webhookSecret = Secret.fromSecretNameV2(
      this,
      'webhook-secret',
      `${environment}/github/hooks/GitHubAppPlayground`
    );
    const idempotencyTable = new TableV2(this, 'idempotency-table', {
      tableName: `github-app-playground-idempotency-${environment}`,
      partitionKey: { name: 'id', type: AttributeType.STRING },
      timeToLiveAttribute: 'expiration',
      billing: Billing.onDemand(),
      removalPolicy:
        environment === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
    });
    const handler = new FunctionConstruct(this, 'webhook-handler', {
      entry: join(import.meta.dirname, 'index.ts'),
      reservedConcurrentExecutions: 10,
      environment: {
        EVENT_BUS_NAME: props.eventBus.eventBusName,
        IDEMPOTENCY_TABLE_NAME: idempotencyTable.tableName,
        REPO_ALLOWLIST: props.repoAllowlist.stringValue,
        WEBHOOK_SECRET_NAME: webhookSecret.secretName,
      },
    });

    props.eventBus.grantPutEventsTo(handler.fn);
    webhookSecret.grantRead(handler.fn);
    idempotencyTable.grantReadWriteData(handler.fn);

    this.api = new HttpApi(this, 'webhook-api', {
      apiName: `github-app-playground-${environment}`,
      description: 'Receives GitHub App webhook events',
      defaultIntegration: new HttpLambdaIntegration(
        'webhook-integration',
        handler.fn
      ),
    });
  }
}

export { WebhookConstruct };
