/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClientServices
 */

import { GuidString, Logger } from "@bentley/bentleyjs-core";
import {
  ChangeSet, ChangeSetQuery, HubIModel, HubUserInfo, IModelHubClient, IModelQuery, UserInfoQuery, Version, VersionQuery,
} from "@bentley/imodelhub-client";
import { IModelVersion } from "@bentley/imodeljs-common";
import { CheckpointConnection, IModelApp, IModelConnection } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework";
import { ChangeSetInfo, IModelInfo, IModelServices, IModelUserInfo, VersionInfo } from "./IModelServices";

// istanbul ignore next
class IModelInfoImpl implements IModelInfo {
  constructor(public name: string, public description: string, public wsgId: string, public createdDate: Date, public iTwinId: GuidString, public status: string = "", public thumbnail: string | undefined) {
  }
}

// istanbul ignore next
class VersionInfoImpl implements VersionInfo {
  constructor(public name: string, public description: string, public createdDate: Date, public changeSetId: string, public userCreated: string | undefined, public smallThumbnail: string | undefined, public largeThumbnail: string | undefined) {
  }
}

// istanbul ignore next
class ChangeSetInfoImpl implements ChangeSetInfo {
  constructor(public name: string, public description: string, public pushDate: Date, public changeSetId: string, public userCreated: string | undefined, public smallThumbnail: string | undefined, public largeThumbnail: string | undefined) {
  }
}

// istanbul ignore next
class IModelUserInfoImpl implements IModelUserInfo {
  constructor(public firstName: string, public lastName: string, public email: string, public id: string = "") {
  }
}

/**
 * Provides default [[IModelServices]]
 * @internal
 */
// istanbul ignore next
export class DefaultIModelServices implements IModelServices {
  private _hubClient: IModelHubClient;

  /** Initialize the iModelHub Api */
  constructor() {
    this._hubClient = new IModelHubClient();
  }

  private async getAccessToken() {
    const accessToken = (await IModelApp.authorizationClient?.getAccessToken());
    if (undefined !== accessToken)
      return accessToken;
    throw new Error("not authorized");

  }
  /** Get all iModels in a project */
  public async getIModels(iTwinId: GuidString, top: number, skip: number): Promise<IModelInfo[]> {
    const accessToken = await this.getAccessToken();

    const iModelInfos: IModelInfo[] = [];
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(top).skip(skip);
    try {
      const iModels: HubIModel[] = await this._hubClient.iModels.get(accessToken, iTwinId, queryOptions);
      for (const imodel of iModels) {
        const versions: Version[] = await this._hubClient.versions.get(accessToken, imodel.id!, new VersionQuery().select("Name,ChangeSetId").top(1));
        if (versions.length > 0) {
          imodel.latestVersionName = versions[0].name;
          imodel.latestVersionChangeSetId = versions[0].changeSetId;
        }
      }
      for (const thisIModel of iModels) {
        iModelInfos.push(this.createIModelInfo(thisIModel, iTwinId));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return iModelInfos;
  }

  /** Open the specified version of the IModel */
  public async openIModel(iTwinId: string, iModelId: GuidString, changeSetId?: string): Promise<IModelConnection> {
    try {
      // GatewayProxyApi.setAccessToken(accessToken);
      const iModelConnection = await CheckpointConnection.openRemote(iTwinId, iModelId, changeSetId ? IModelVersion.asOfChangeSet(changeSetId) : IModelVersion.latest());
      return iModelConnection;
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
  }

  /** Get the thumbnail for the iModel */
  public async getThumbnail(iTwinId: string, iModelId: GuidString): Promise<string | undefined> {
    const accessToken = await this.getAccessToken();
    try {
      const pngImage = await this._hubClient.thumbnails.download(accessToken, iModelId, { contextId: iTwinId, size: "Small" });
      return pngImage;
    } catch (err) {
      // No image available
    }
    return undefined;
  }

  /** Get versions (top 5 for testing) for the iModel */
  public async getVersions(iModelId: GuidString): Promise<VersionInfo[]> {
    const accessToken = await this.getAccessToken();
    const versionInfos: VersionInfo[] = [];
    try {
      const versions: Version[] = await this._hubClient.versions.get(accessToken, iModelId, new VersionQuery().select("*").top(5));
      for (const thisVersion of versions) {
        versionInfos.push(this.createVersionInfo(thisVersion));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return versionInfos;
  }

  /** Get changesets (top 5 for testing) for the iModel */
  public async getChangeSets(iModelId: GuidString): Promise<ChangeSetInfo[]> {
    const accessToken = await this.getAccessToken();
    const changeSetInfos: ChangeSetInfo[] = [];
    try {
      const changesets: ChangeSet[] = await this._hubClient.changeSets.get(accessToken, iModelId, new ChangeSetQuery().top(5).latest());
      for (const thisChangeSet of changesets) {
        changeSetInfos.push(this.createChangeSetInfo(thisChangeSet));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return changeSetInfos;
  }

  /** Get users that have access to a particular iModel */
  public async getUsers(iModelId: GuidString): Promise<IModelUserInfo[]> {
    const accessToken = await this.getAccessToken();
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: HubUserInfo[] = await this._hubClient.users.get(accessToken, iModelId, new UserInfoQuery().select("*"));
      for (const userInfo of users) {
        userInfos.push(this.createUserInfo(userInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return userInfos;
  }

  public async getUser(iModelId: GuidString, userId: string): Promise<IModelUserInfo[]> {
    const accessToken = await this.getAccessToken();
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: HubUserInfo[] = await this._hubClient.users.get(accessToken, iModelId, new UserInfoQuery().byId(userId));
      for (const userInfo of users) {
        userInfos.push(this.createUserInfo(userInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return userInfos;
  }

  private createIModelInfo(thisIModel: HubIModel, iTwinId: GuidString): IModelInfo {
    const createDate: Date = new Date(thisIModel.createdDate!);
    Logger.logTrace(UiFramework.loggerCategory(this), `Working on iModel '${thisIModel.name}'`);
    const thisIModelInfo: IModelInfo = new IModelInfoImpl(thisIModel.name!, thisIModel.description!, thisIModel.wsgId, createDate, iTwinId, "", thisIModel.thumbnail);
    return thisIModelInfo;
  }

  private createVersionInfo(thisVersion: Version): VersionInfo {
    const createDate: Date = new Date(thisVersion.createdDate!);
    // eslint-disable-next-line deprecation/deprecation
    const thisVersionInfo: VersionInfo = new VersionInfoImpl(thisVersion.name!, thisVersion.description!, createDate, thisVersion.changeSetId!, thisVersion.userCreated, thisVersion.smallThumbnailId!.toString(), thisVersion.largeThumbnailId!.toString());
    return thisVersionInfo;
  }

  private createChangeSetInfo(thisChangeSet: ChangeSet): ChangeSetInfo {
    const pushDate: Date = new Date(thisChangeSet.pushDate!);
    const thisChangeSetInfo: ChangeSetInfo = new ChangeSetInfoImpl(thisChangeSet.name!, thisChangeSet.description!, pushDate, thisChangeSet.changeSetId!, thisChangeSet.userCreated, thisChangeSet.smallThumbnailId!, thisChangeSet.largeThumbnailId!);
    return thisChangeSetInfo;
  }

  private createUserInfo(thisUser: HubUserInfo): IModelUserInfo {
    const thisUserInfo: IModelUserInfo = new IModelUserInfoImpl(thisUser.firstName!, thisUser.lastName!, thisUser.email!, thisUser.id);
    return thisUserInfo;
  }
}
