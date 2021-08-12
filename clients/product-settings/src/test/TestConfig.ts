/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, ITwin } from "@bentley/context-registry-client";
import { HubIModel, IModelClient, IModelHubClient } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of container used by most tests */
  public static readonly contextContainerName: string = "iModelJsIntegrationTest";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials = TestUsers.regular): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext((accessToken as any) as AccessToken);
  }

  public static async getContextContainerByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const contextRegistry = new ContextRegistryClient();
    const container: ITwin | undefined = await contextRegistry.getContextContainerByName(requestContext, name);
    if (!container || !container.id)
      throw new Error(`Context container ${name} not found for user.`);
    return container;
  }

  public static async queryIModel(requestContext: AuthorizedClientRequestContext, containerId: GuidString): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = await imodelHubClient.iModel.get(requestContext, containerId);
    if (!iModel || !iModel.wsgId)
      throw new Error(`Primary iModel not found for context container ${containerId}`);
    return iModel;
  }
}
