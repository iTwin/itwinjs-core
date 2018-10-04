/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { IModelHubClient, AccessToken, HubIModel, Version, UserInfo, ChangeSet, UserInfoQuery, IModelQuery, ChangeSetQuery, VersionQuery } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { IModelConnection } from "@bentley/imodeljs-frontend";

// import GatewayProxyApi from "./gatewayProxy";
import { IModelVersion } from "@bentley/imodeljs-common";

import { UiFramework } from "../UiFramework";
import { ProjectInfo } from "./ProjectServices";
import { IModelInfo, IModelServices, VersionInfo, ChangeSetInfo, IModelUserInfo } from "./IModelServices";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

class IModelInfoImpl implements IModelInfo {
  constructor(public name: string, public description: string, public wsgId: string, public createdDate: Date, public projectInfo: ProjectInfo, public status: string = "", public thumbnail: string | undefined) {
  }
}

class VersionInfoImpl implements VersionInfo {
  constructor(public name: string, public description: string, public createdDate: Date, public changeSetId: string, public userCreated: string | undefined, public smallThumbnail: string | undefined, public largeThumbnail: string | undefined) {
  }
}

class ChangeSetInfoImpl implements ChangeSetInfo {
  constructor(public name: string, public description: string, public pushDate: Date, public changeSetId: string, public userCreated: string | undefined, public smallThumbnail: string | undefined, public largeThumbnail: string | undefined) {
  }
}

class IModelUserInfoImpl implements IModelUserInfo {
  constructor(public firstName: string, public lastName: string, public email: string, public id: string = "") {
  }
}

/**
 * Provides default [[IModelServices]]
 */
export class DefaultIModelServices implements IModelServices {
  private _hubClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  constructor() {
    this._hubClient = new IModelHubClient(UiFramework.projectServices.deploymentEnv);
  }

  /** Get all iModels in a project */
  public async getIModels(accessToken: AccessToken, projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const iModelInfos: IModelInfo[] = [];
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(top).skip(skip);
    try {
      const iModels: HubIModel[] = await this._hubClient.IModels().get(alctx, accessToken, projectInfo.wsgId, queryOptions);
      for (const imodel of iModels) {
        const versions: Version[] = await this._hubClient.Versions().get(alctx, accessToken, imodel.id!, new VersionQuery().select("Name,ChangeSetId").top(1));
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
    const alctx = new ActivityLoggingContext(Guid.createValue());
    try {
      const pngImage = await this._hubClient.Thumbnails().download(alctx, accessToken, new Guid(iModelId), { projectId: projectId!, size: "Small" });
      return pngImage;
    } catch (err) {
      // No image available
    }
    return undefined;
  }

  /** Get versions (top 5 for testing) for the iModel */
  public async getVersions(accessToken: AccessToken, iModelId: string): Promise<VersionInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const versionInfos: VersionInfo[] = [];
    try {
      const versions: Version[] = await this._hubClient.Versions().get(alctx, accessToken, new Guid(iModelId), new VersionQuery().select("*").top(5));
      for (const thisVersion of versions) {
        versionInfos.push(this.createVersionInfo(thisVersion));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
    return versionInfos;
  }

  /** Get changesets (top 5 for testing) for the iModel */
  public async getChangeSets(accessToken: AccessToken, iModelId: string): Promise<ChangeSetInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const changeSetInfos: ChangeSetInfo[] = [];
    try {
      const changesets: ChangeSet[] = await this._hubClient.ChangeSets().get(alctx, accessToken, new Guid(iModelId), new ChangeSetQuery().top(5).latest());
      for (const thisChangeSet of changesets) {
        changeSetInfos.push(this.createChangeSetInfo(thisChangeSet));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
    return changeSetInfos;
  }

  /** Get users that have access to a particular iModel */
  public async getUsers(accessToken: AccessToken, iModelId: string): Promise<IModelUserInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: UserInfo[] = await this._hubClient.Users().get(alctx, accessToken, new Guid(iModelId), new UserInfoQuery().select("*"));
      for (const userInfo of users) {
        userInfos.push(this.createUserInfo(userInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
    return userInfos;
  }

  public async getUser(accessToken: AccessToken, iModelId: string, userId: string): Promise<IModelUserInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: UserInfo[] = await this._hubClient.Users().get(alctx, accessToken, new Guid(iModelId), new UserInfoQuery().byId(userId));
      for (const userInfo of users) {
        userInfos.push(this.createUserInfo(userInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }
    return userInfos;
  }

  private createIModelInfo(thisIModel: HubIModel, thisProjectInfo: ProjectInfo): IModelInfo {
    const createDate: Date = new Date(thisIModel.createdDate!);
    console.log("Working on iModel", thisIModel.name); // tslint:disable-line:no-console
    const thisIModelInfo: IModelInfo = new IModelInfoImpl(thisIModel.name!, thisIModel.description!, thisIModel.wsgId, createDate, thisProjectInfo, "", thisIModel.thumbnail);
    return thisIModelInfo;
  }

  private createVersionInfo(thisVersion: Version): VersionInfo {
    const createDate: Date = new Date(thisVersion.createdDate!);
    const thisVersionInfo: VersionInfo = new VersionInfoImpl(thisVersion.name!, thisVersion.description!, createDate, thisVersion.changeSetId!, thisVersion.userCreated!, thisVersion.smallThumbnailId!.toString(), thisVersion.largeThumbnailId!.toString());
    return thisVersionInfo;
  }

  private createChangeSetInfo(thisChangeSet: ChangeSet): ChangeSetInfo {
    const pushDate: Date = new Date(thisChangeSet.pushDate!);
    const thisChangeSetInfo: ChangeSetInfo = new ChangeSetInfoImpl(thisChangeSet.name!, thisChangeSet.description!, pushDate, thisChangeSet.changeSetId!, thisChangeSet.userCreated!, thisChangeSet.smallThumbnailId!, thisChangeSet.largeThumbnailId!);
    return thisChangeSetInfo;
  }

  private createUserInfo(thisUser: UserInfo): IModelUserInfo {
    const thisUserInfo: IModelUserInfo = new IModelUserInfoImpl(thisUser.firstName!, thisUser.lastName!, thisUser.email!, thisUser.id);
    return thisUserInfo;
  }
}
