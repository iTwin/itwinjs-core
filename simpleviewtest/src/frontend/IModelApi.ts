/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { IModelHubClient, AccessToken, IModelRepository, Version, IModelQuery, VersionQuery } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// import GatewayProxyApi from "./gatewayProxy";
import { ProjectApi } from "./ProjectApi";
import { IModelVersion } from "@bentley/imodeljs-common";

export class IModelApi {
  private static imodelClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  public static async init(): Promise<void> {
    IModelApi.imodelClient = new IModelHubClient(ProjectApi.hubDeploymentEnv);
  }

  /** Get all iModels in a project */
  public static async getIModelByName(accessToken: AccessToken, projectId: string, iModelName: string): Promise<IModelRepository | undefined> {
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(100).skip(0);
    const iModels: IModelRepository[] = await IModelApi.imodelClient.IModels().get(accessToken, projectId, queryOptions);
    if (iModels.length < 1)
      return undefined;
    for (const thisIModel of iModels) {
      if (thisIModel.name === iModelName) {
        const versions: Version[] = await IModelApi.imodelClient.Versions().get(accessToken, thisIModel.wsgId, new VersionQuery().select("Name,ChangeSetId").top(1));
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
