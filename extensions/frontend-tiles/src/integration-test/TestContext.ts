import { AccessToken } from "@itwin/core-bentley";
import { getAccessTokenFromBackend } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

export class TestContext {
  private _accessToken: AccessToken | undefined;
  private static _instance?: TestContext = undefined;

  private constructor() { }

  public static async instance(): Promise<TestContext> {

    if (this._instance === undefined) {
      this._instance = new TestContext();
      await this._instance.initialize();
    }
    return this._instance;
  }

  public getAccessToken(): AccessToken | undefined {
    return this._accessToken;
  }

  private async initialize() {
    const oidcConfig = {
      clientId: process.env.OIDC_CLIENT_ID || "",
      redirectUri: process.env.OIDC_REDIRECT_URI || "",
      scope: process.env.OIDC_IMODEL_SCOPE || "",
      authority: process.env.OIDC_AUTHORITY_URL || "",
    };

    const user = {
      email: process.env.MES_INTEGRATION_USERNAME || "",
      password: process.env.MES_INTEGRATION_PASSWORD || "",
    };

    // Generate access token
    let numRetries = 0;
    while (numRetries < 3) {
      try {
        this._accessToken = await getAccessTokenFromBackend( user, oidcConfig);
      } catch (err) {

        if (numRetries === 2) {
          throw err;
        }
        numRetries++;
        continue;
      }

      break;
    }

    if (!this._accessToken || this._accessToken === "") {
      throw new Error("Could not generate OAuth token!");
    }
  }
}
