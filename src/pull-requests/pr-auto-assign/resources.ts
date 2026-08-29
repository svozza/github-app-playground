import { join } from 'node:path';
import {
  type EventBus,
  type EventPattern,
  Match,
  Rule,
} from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import type { ISecret } from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { FunctionConstruct } from '../../shared-resources.ts';

interface PrAutoAssignHandlerProps {
  eventBus: EventBus;
  appInfoSecret: ISecret;
}

const prAutoAssignEventPattern: EventPattern = {
  source: ['github.com'],
  detailType: Match.exactString('pull_request.opened'),
  detail: {
    sender: {
      type: Match.anythingBut('Bot'),
    },
  },
};

class PrAutoAssignHandler extends Construct {
  public constructor(
    scope: Construct,
    id: string,
    props: PrAutoAssignHandlerProps
  ) {
    super(scope, id);

    const environment = this.node.getContext('environment');
    const handler = new FunctionConstruct(this, 'pr-auto-assign-handler', {
      entry: join(import.meta.dirname, 'index.ts'),
      environment: {
        APP_INFO_SECRET_NAME: props.appInfoSecret.secretName,
      },
    });

    props.appInfoSecret.grantRead(handler.fn);

    new Rule(this, 'pr-auto-assign-rule', {
      ruleName: `pr-auto-assign-${environment}`,
      eventBus: props.eventBus,
      eventPattern: prAutoAssignEventPattern,
      targets: [new LambdaFunction(handler.fn)],
    });
  }
}

export { PrAutoAssignHandler, prAutoAssignEventPattern };
