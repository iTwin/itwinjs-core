/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { IModelHubClient, AccessToken, HubIModel, Version, IModelQuery, VersionQuery } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// import GatewayProxyApi from "./gatewayProxy";
import { ProjectApi } from "./ProjectApi";
import { IModelVersion } from "@bentley/imodeljs-common";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

export class IModelApi {
  private static _hubClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  public static async init(): Promise<void> {
    IModelApi._hubClient = new IModelHubClient(ProjectApi.hubDeploymentEnv);
  }

  /** Get all iModels in a project */
  public static async getIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<HubIModel | undefined> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(100).skip(0);
    const iModels: HubIModel[] = await IModelApi._hubClient.IModels().get(alctx, accessToken, projectId, queryOptions);
    if (iModels.length < 1)
      return undefined;
    for (const thisIModel of iModels) {
      if (!!thisIModel.id && thisIModel.name === iModelName) {
        const versions: Version[] = await IModelApi._hubClient.Versions().get(alctx, accessToken, thisIModel.id!, new VersionQuery().select("Name,ChangeSetId").top(1));
        if (versions.length > 0) {
          thisIModel.latestVersionName = versions[0].name;
          thisIModel.latestVersionChangeSetId = versions[0].changeSetId;
        }
        return thisIModel;
      }
    }
    return undefined;
  }

  /** Open the specified version of the IModel */
  public static async openIModel(accessToken: AccessToken, projectId: string, iModelId: string, changeSetId: string | undefined, openMode: OpenMode): Promise<IModelConnection> {
    return await IModelConnection.open(accessToken!, projectId, iModelId, openMode, changeSetId ? IModelVersion.asOfChangeSet(changeSetId) : IModelVersion.latest());
  }
}
