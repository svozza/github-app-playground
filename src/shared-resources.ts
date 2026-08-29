import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  Architecture,
  type Function as LambdaFunction,
  Runtime,
} from 'aws-cdk-lib/aws-lambda';
import {
  NodejsFunction,
  type NodejsFunctionProps,
  OutputFormat,
} from 'aws-cdk-lib/aws-lambda-nodejs';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

class FunctionConstruct extends Construct {
  public readonly fn: LambdaFunction;

  public constructor(
    scope: Construct,
    id: string,
    props: Omit<NodejsFunctionProps, 'functionName' | 'runtime'>
  ) {
    super(scope, id);

    const environment = this.node.getContext('environment');
    const appVersion = this.node.getContext('appVersion');
    const functionName = `${id}-fn-${environment}`;

    this.fn = new NodejsFunction(this, `${id}-fn`, {
      architecture: Architecture.ARM_64,
      memorySize: 256,
      timeout: Duration.seconds(10),
      logGroup: new LogGroup(this, `${id}-logs`, {
        logGroupName: `/aws/lambda/${functionName}`,
        removalPolicy:
          environment === 'dev' ? RemovalPolicy.DESTROY : RemovalPolicy.RETAIN,
        retention: RetentionDays.ONE_MONTH,
      }),
      handler: 'handler',
      ...props,
      functionName,
      runtime: Runtime.NODEJS_24_X,
      bundling: {
        minify: true,
        sourceMap: true,
        format: OutputFormat.ESM,
        mainFields: ['module', 'main'],
        ...props.bundling,
      },
      environment: {
        APP_VERSION: appVersion,
        ENVIRONMENT: environment,
        POWERTOOLS_SERVICE_NAME: 'github-app-playground',
        POWERTOOLS_LOGGER_LOG_EVENT: String(environment === 'dev'),
        POWERTOOLS_LOG_LEVEL: environment === 'dev' ? 'DEBUG' : 'INFO',
        ...props.environment,
      },
    });
  }
}

export { FunctionConstruct };
