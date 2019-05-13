/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { assert } from "chai";
import { ConnectClient, Project, IModelHubClient, IModelQuery } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

export class TestUtility {
  public static connectClient = new ConnectClient();
  public static imodelClient = new IModelHubClient();

  public static async getTestProjectId(projectName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const project: Project = await this.connectClient.getProject(requestContext, {
      $select: "*",
      $filter: "Name+eq+'" + projectName + "'",
    });
    assert(project && project.wsgId);
    return project.wsgId;
  }

  public static async getTestIModelId(projectId: string, iModelName: string): Promise<string> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const iModels = await this.imodelClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName));
    assert(iModels.length > 0);
    assert(iModels[0].wsgId);

    return iModels[0].wsgId;
  }
}
