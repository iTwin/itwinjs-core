/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { GuidString } from "@bentley/bentleyjs-core";
import { ITwin, ITwinAccessClient } from "@bentley/context-registry-client";
import { HubIModel, IModelClient, IModelHubClient } from "@bentley/imodelhub-client";
import { AccessToken, AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { getAccessTokenFromBackend, TestUserCredentials, TestUsers } from "@bentley/oidc-signin-tool/lib/frontend";

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of the iTwin used by most tests */
  public static readonly iTwinName: string = "iModelJsIntegrationTest";

  /** Login the specified user and return the AuthorizationToken */
  public static async getAuthorizedClientRequestContext(user: TestUserCredentials = TestUsers.regular): Promise<AuthorizedClientRequestContext> {
    const accessToken = await getAccessTokenFromBackend(user);
    return new AuthorizedClientRequestContext((accessToken as any) as AccessToken);
  }

  public static async getITwinByName(requestContext: AuthorizedClientRequestContext, name: string): Promise<ITwin> {
    const iTwinAccessClient = new ITwinAccessClient();
    const iTwinList: ITwin[] = await iTwinAccessClient.getAllByName(requestContext, name);

    if (iTwinList.length === 0)
      throw new Error(`ITwin ${name} was not found for the user.`);
    else if (iTwinList.length > 1)
      throw new Error(`Multiple iTwins named ${name} were found for the user.`);

    return iTwinList[0];
  }

  public static async queryIModel(requestContext: AuthorizedClientRequestContext, iTwinId: GuidString): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = await imodelHubClient.iModel.get(requestContext, iTwinId);
    if (!iModel || !iModel.wsgId)
      throw new Error(`Primary iModel not found for iTwin ${iTwinId}.`);
    return iModel;
  }
}
