/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { AccessToken } from "@bentley/bentleyjs-core";
import { getAccessTokenFromBackend, TestUserCredentials, TestUsers } from "@bentley/oidc-signin-tool/lib/cjs/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of the iTwin used by some tests */
  public static readonly iTwinName: string = "iModelJsIntegrationTest";

  /** Id of the iTwin used by some tests */
  public static readonly iTwinId: string = "ec002f93-f0c1-4ab3-a407-351848eba233";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAccessToken(user: TestUserCredentials = TestUsers.regular): Promise<AccessToken> {
    return getAccessTokenFromBackend(user);
  }
}
