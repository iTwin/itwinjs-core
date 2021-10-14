/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@itwin/core-bentley";
import { getAccessTokenFromBackend, TestBrowserAuthorizationClientConfiguration, TestUserCredentials, TestUsers } from "@itwin/oidc-signin-tool/lib/cjs/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of the iTwin used by some tests */
  public static readonly iTwinName: string = "iModelJsIntegrationTest";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAccessToken(user: TestUserCredentials = TestUsers.regular): Promise<AccessToken> {
    const debugConfig: TestBrowserAuthorizationClientConfiguration = {
      clientId: process.env.IMJS_OIDC_BROWSER_TEST_CLIENT_ID ?? "",
      redirectUri: process.env.IMJS_OIDC_BROWSER_TEST_REDIRECT_URI ?? "",
      // scope: `${process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? ""} projects:read`,
      scope: process.env.IMJS_OIDC_BROWSER_TEST_SCOPES ?? "",
    };
    return getAccessTokenFromBackend(user, debugConfig);
  }
}
