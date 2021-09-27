/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/context-registry-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials, TestUsers } from "@itwin/oidc-signin-tool/lib/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of iTwins (Projects or Assets) used by most tests */
  public static readonly iTwinName: string = "iModelJsIntegrationTest";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials = TestUsers.regular): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext((accessToken as any) as AccessToken);
  }

  public static async getITwinByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const iTwinAccessClient = new ITwinAccessClient();
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(requestContext, {
      search: {
        searchString: name,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }
}
