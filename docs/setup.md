# Setup Runbook

This sequence avoids the circular dependency between the GitHub App webhook
URL and the deployed API Gateway URL.

## 1. Verify the AWS profile

The local commands use the `admin` profile.

```bash
aws configure list-profiles
AWS_PROFILE=admin aws sts get-caller-identity
```

If the profile is managed by IAM Identity Center, create or refresh it:

```bash
aws configure sso --profile admin
aws sso login --profile admin
```

Record the account ID and chosen AWS region.

## 2. Create the GitHub App

This form is a required browser step; GitHub does not provide an API for
creating a GitHub App.

1. Open GitHub **Settings**.
2. Select **Developer settings**, **GitHub Apps**, then **New GitHub App**.
3. Use an app name such as `svozza-github-app-playground`. GitHub App names are
   globally unique.
4. Set the homepage URL to this repository.
5. Use `https://example.com/github-app-playground/pending` as the temporary
   webhook URL.
6. Generate a strong webhook secret and store it in a password manager.
7. Under repository permissions set:
   - **Issues:** Read and write
   - **Pull requests:** Read and write
   - **Metadata:** Read-only
8. Subscribe to **Pull request** events.
9. Limit installation to **Only on this account**.
10. Create the App and record its numeric **App ID**.
11. Generate a private key and keep the downloaded PEM file outside this
    repository.

Do not install the App until the scratch repository is ready.

## 3. Create AWS configuration

Choose a scratch repository that will receive the App. Add its full name to the
allowlist:

```bash
AWS_PROFILE=admin aws ssm put-parameter \
  --name /dev/github/apps/GitHubAppPlayground/allowlist \
  --type String \
  --value svozza/github-app-playground \
  --overwrite
```

Create the webhook secret:

```bash
AWS_PROFILE=admin aws secretsmanager create-secret \
  --name dev/github/hooks/GitHubAppPlayground \
  --secret-string 'REPLACE_WITH_WEBHOOK_SECRET'
```

Create the App credential secret. The private key must retain its PEM newlines:

```bash
jq -n \
  --argjson appId REPLACE_WITH_NUMERIC_APP_ID \
  --rawfile privateKey /absolute/path/to/private-key.pem \
  '{appId: $appId, privateKey: $privateKey}' \
  > /tmp/github-app-info.json

AWS_PROFILE=admin aws secretsmanager create-secret \
  --name dev/github/apps/GitHubAppPlayground \
  --secret-string file:///tmp/github-app-info.json
```

If either secret already exists, use `put-secret-value` instead of
`create-secret`.

## 4. Bootstrap and deploy locally

```bash
export AWS_PROFILE=admin
export AWS_REGION=REPLACE_WITH_REGION
export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"

npx cdk bootstrap "aws://${AWS_ACCOUNT_ID}/${AWS_REGION}"
npm run deploy
```

Copy the `WebhookUrl` stack output.

## 5. Finish GitHub App configuration

1. Return to the GitHub App settings page.
2. Replace the temporary webhook URL with the deployed `WebhookUrl`.
3. Confirm **Active** is enabled and save.
4. Select **Install App**.
5. Install it only on the scratch repository.

No deployment is needed after changing the webhook URL or installing the App.

## 6. Configure GitHub Actions OIDC

In AWS IAM, add the GitHub Actions OIDC provider if the account does not
already have it:

- Provider URL: `https://token.actions.githubusercontent.com`
- Audience: `sts.amazonaws.com`

Create a deployment role whose trust policy permits only this repository's
`dev` GitHub Environment:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:svozza/github-app-playground:environment:dev"
        }
      }
    }
  ]
}
```

Grant the role permission to deploy this CDK stack. For a prototype, an
administrator policy is expedient but broad. A least-privilege policy should
cover CloudFormation, Lambda, API Gateway, EventBridge, DynamoDB, CloudWatch
Logs, IAM role and policy management, SSM reads, Secrets Manager metadata and
grants, S3 CDK assets, and the CDK bootstrap roles.

Create a GitHub environment named `dev`, then add these environment variables:

- `AWS_REGION`
- `AWS_DEPLOY_ROLE_ARN`

The deploy workflow uses OIDC and stores no long-lived AWS access keys.

## 7. Verify end to end

1. Create a branch in the scratch repository.
2. Open a pull request from a human account.
3. In the GitHub App settings, open **Advanced** and confirm the delivery
   received a 202 response.
4. Confirm the PR author is added as assignee under the App's identity.
5. If it fails, inspect these CloudWatch log groups:
   - `/aws/lambda/webhook-handler-fn-dev`
   - `/aws/lambda/pr-auto-assign-handler-fn-dev`
6. Check the `pr-auto-assign-dev` EventBridge rule and the event bus archive.
