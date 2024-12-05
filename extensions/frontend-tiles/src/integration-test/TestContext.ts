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
    if (!process.env.IMJS_MES_INTEGRATION_OIDC_CLIENT_ID || !process.env.IMJS_TEST_REGULAR_USER_NAME || !process.env.IMJS_TEST_REGULAR_USER_PASSWORD)
      throw new Error("Missing required environment variables, could not authenticate.");

    const urlPrefix = process.env.IMJS_URL_PREFIX || "";
    const oidcConfig = {
      clientId: process.env.IMJS_MES_INTEGRATION_OIDC_CLIENT_ID,
      redirectUri: "http://localhost:3000/signin-callback",
      scope: "itwin-platform",
      authority: `https://${urlPrefix}ims.bentley.com`,
    };

    const user = {
      email: process.env.IMJS_TEST_REGULAR_USER_NAME,
      password: process.env.IMJS_TEST_REGULAR_USER_PASSWORD,
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
