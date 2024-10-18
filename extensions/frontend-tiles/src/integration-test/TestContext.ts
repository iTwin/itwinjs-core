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
    const urlPrefix = process.env.imjs_url_prefix || "";
    const oidcConfig = {
      clientId: process.env.mes_oidc_client_id || "",
      redirectUri: process.env.mes_oidc_redirect || "",
      scope: process.env.mes_oidc_scope || "",
      authority: `https://${urlPrefix}ims.bentley.com`,
    };

    const user = {
      email: process.env.mes_integration_testuser || "",
      password: process.env.mes_integration_testpassword || "",
    };

    // Generate access token
    let numRetries = 0;
    while (numRetries < 3) {
      try {
        this._accessToken = await getAccessTokenFromBackend(user, oidcConfig);
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
