import { getStringFromEnv } from '@aws-lambda-powertools/commons/utils/env';
import { getSecret } from '@aws-lambda-powertools/parameters/secrets';
import { App } from 'octokit';

interface AppInfo {
  appId: number;
  privateKey: string;
}

type InstallationClient = Awaited<ReturnType<App['getInstallationOctokit']>>;

const appInfoSecretName = getStringFromEnv({
  key: 'APP_INFO_SECRET_NAME',
});
const appInfo = await getSecret<AppInfo>(appInfoSecretName, {
  transform: 'json',
  maxAge: 60 * 60 * 24,
});

if (!appInfo) {
  throw new Error('GitHub App information was not found in Secrets Manager');
}

class GitHubApp {
  readonly #app: App;
  readonly #clients = new Map<
    number,
    { client: InstallationClient; createdAt: number }
  >();
  readonly #clientMaxAge = 1000 * 60 * 50;

  public constructor(info: AppInfo) {
    this.#app = new App(info);
  }

  public async getInstallationClient(installationId: number) {
    const cached = this.#clients.get(installationId);

    if (!cached || Date.now() - cached.createdAt > this.#clientMaxAge) {
      this.#clients.set(installationId, {
        client: await this.#app.getInstallationOctokit(installationId),
        createdAt: Date.now(),
      });
    }

    const client = this.#clients.get(installationId);
    if (!client) {
      throw new Error('Failed to create GitHub installation client');
    }
    return client.client;
  }
}

const githubApp = new GitHubApp(appInfo);

export type { AppInfo, InstallationClient };
export { GitHubApp, githubApp };
