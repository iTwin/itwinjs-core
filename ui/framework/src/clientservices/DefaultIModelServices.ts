/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { IModelHubClient, AccessToken, IModelRepository, Version, IModelQuery, VersionQuery } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// import GatewayProxyApi from "./gatewayProxy";
import { IModelVersion } from "@bentley/imodeljs-common";

import { UiFramework } from "../UiFramework";
import { ProjectInfo } from "./ProjectServices";
import { IModelInfo, IModelServices } from "./IModelServices";

class IModelInfoImpl implements IModelInfo {
  constructor(public name: string, public description: string, public wsgId: string, public createdDate: Date, public projectInfo: ProjectInfo, public status: string = "", public thumbnail: string | undefined) {
  }
}

/**
 * Provides default [[IModelServices]]
 */
export class DefaultIModelServices implements IModelServices {
  private hubClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  constructor() {
    this.hubClient = new IModelHubClient(UiFramework.projectServices.deploymentEnv);
  }

  /** Get all iModels in a project */
  public async getIModels(accessToken: AccessToken, projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]> {

    const iModelInfos: IModelInfo[] = [];
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(top).skip(skip);
    try {
      const iModels: IModelRepository[] = await this.hubClient.IModels().get(accessToken, projectInfo.wsgId, queryOptions);
      for (const imodel of iModels) {
        const versions: Version[] = await this.hubClient.Versions().get(accessToken, imodel.wsgId, new VersionQuery().select("Name,ChangeSetId").top(1));
        if (versions.length > 0) {
          imodel.latestVersionName = versions[0].name;
          imodel.latestVersionChangeSetId = versions[0].changeSetId;
        }
      }
      for (const thisIModel of iModels) {
        iModelInfos.push(this.createIModelInfo(thisIModel, projectInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
    return iModelInfos;
  }

  /** Open the specified version of the IModel */
  public async openIModel(accessToken: AccessToken, projectInfo: ProjectInfo, iModelId: string, openMode?: OpenMode, changeSetId?: string): Promise<IModelConnection> {
    try {
      // GatewayProxyApi.setAccessToken(accessToken);
      const iModelConnection: IModelConnection = await IModelConnection.open(accessToken!, projectInfo.wsgId, iModelId, openMode ? openMode : OpenMode.Readonly, changeSetId ? IModelVersion.asOfChangeSet(changeSetId) : IModelVersion.latest());
      return iModelConnection;
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
  }

  /** Get the thumbnail for the iModel */
  public async getThumbnail(accessToken: AccessToken, projectId: string, iModelId: string): Promise<string | undefined> {

    try {
      const pngImage = await this.hubClient.Thumbnails().download(accessToken, iModelId, { projectId: projectId!, size: "Small" });
      return pngImage;
    } catch (err) {
      // No image available
    }
    return undefined;
  }

  private createIModelInfo(thisIModel: IModelRepository, thisProjectInfo: ProjectInfo): IModelInfo {
    const createDate: Date = new Date(thisIModel.createdDate!);
    console.log("Working on iModel", thisIModel.name); // tslint:disable-line:no-console
    const thisIModelInfo: IModelInfo = new IModelInfoImpl(thisIModel.name!, thisIModel.description!, thisIModel.wsgId, createDate, thisProjectInfo, "", thisIModel.thumbnail);
    return thisIModelInfo;
  }
}
