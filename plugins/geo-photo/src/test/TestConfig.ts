/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chai from "chai";

import { GuidString } from "@bentley/bentleyjs-core";
import {
  AuthorizedClientRequestContext,
  ConnectClient, HubIModel, IModelHubClient,
  IModelClient, IModelQuery, Project,
} from "@bentley/imodeljs-clients";
import { getAccessTokensFromBackend } from "./common/SideChannels";

/**
 * Basic configuration used by all tests
 */
export class TestConfig {
  public static async getAuthorizedClientRequestContext(): Promise<AuthorizedClientRequestContext> {
    const accessTokens = await getAccessTokensFromBackend();
    chai.assert.isAtLeast(accessTokens.length, 1);
    return new AuthorizedClientRequestContext(accessTokens[0]);
  }

  public static async queryProject(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project> {
    const connectClient = new ConnectClient();
    const project: Project | undefined = await connectClient.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId)
      throw new Error(`Project ${projectName} not found for user.`);
    return project;
  }

  public static async queryIModel(requestContext: AuthorizedClientRequestContext, projectId: GuidString, iModelName: string): Promise<HubIModel> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModels: HubIModel[] = await imodelHubClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
    if (iModels.length === 0)
      throw new Error(`iModel ${iModelName} not found in project ${projectId}`);
    return iModels[0];
  }
}
