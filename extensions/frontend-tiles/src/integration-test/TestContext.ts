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
    // const user = {
      email: process.env.TEST_USERNAME || "",
      password: process.env.TEST_PASSWORD || "",
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

        console.log("Retrying to get access token");
        numRetries++;
        continue;
      }

      break;
    }

    // Generate access token
    // this._accessToken = await getTestAccessToken(oidcConfig, user);
    if (!this._accessToken || this._accessToken === "") {
      console.log("Could not generate OAuth token!");
      throw new Error("Could not generate OAuth token!");
    }
    console.log("TestSetup complete");
  }
}
