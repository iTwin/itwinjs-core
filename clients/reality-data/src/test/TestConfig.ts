/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContextContainerNTBD, ContextRegistryClient } from "@bentley/context-registry-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of context containers (Projects or Assets) used by most tests */
  public static readonly containerName: string = "iModelJsIntegrationTest";
  public static readonly enableMocks: boolean = isOfflineSet();

  /** Login the specified user and return the AuthorizationToken */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials = TestUsers.regular): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext((accessToken as any) as AccessToken);
  }

  public static async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ContextContainerNTBD> {
    const contextRegistry = new ContextRegistryClient();
    const container: ContextContainerNTBD | undefined = await contextRegistry.getContextContainerByName(requestContext, name);
    if (!container || !container.id)
      throw new Error(`Context container ${name} not found for user.`);
    return container;
  }
}
