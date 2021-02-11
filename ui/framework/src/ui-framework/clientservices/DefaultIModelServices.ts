/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClientServices
 */

import { GuidString, Logger, OpenMode } from "@bentley/bentleyjs-core";
import {
  ChangeSet, ChangeSetQuery, HubIModel, HubUserInfo, IModelHubClient, IModelQuery, UserInfoQuery, Version, VersionQuery,
} from "@bentley/imodelhub-client";
// import GatewayProxyApi from "./gatewayProxy";
import { IModelVersion } from "@bentley/imodeljs-common";
import { AuthorizedFrontendRequestContext, IModelConnection, RemoteBriefcaseConnection } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework";
import { ChangeSetInfo, IModelInfo, IModelServices, IModelUserInfo, VersionInfo } from "./IModelServices";
import { ProjectInfo } from "./ProjectServices";

// istanbul ignore next
class IModelInfoImpl implements IModelInfo {
  constructor(public name: string, public description: string, public wsgId: string, public createdDate: Date, public projectInfo: ProjectInfo, public status: string = "", public thumbnail: string | undefined) {
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

  /** Get all iModels in a project */
  public async getIModels(projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    const iModelInfos: IModelInfo[] = [];
    const queryOptions = new IModelQuery();
    queryOptions.select("*").top(top).skip(skip);
    try {
      const iModels: HubIModel[] = await this._hubClient.iModels.get(requestContext, projectInfo.wsgId, queryOptions);
      for (const imodel of iModels) {
        const versions: Version[] = await this._hubClient.versions.get(requestContext, imodel.id!, new VersionQuery().select("Name,ChangeSetId").top(1));
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
      throw e;
    }
    return iModelInfos;
  }

  /** Open the specified version of the IModel */
  public async openIModel(contextId: string, iModelId: GuidString, openMode?: OpenMode, changeSetId?: string): Promise<IModelConnection> {
    try {
      // GatewayProxyApi.setAccessToken(accessToken);
      const iModelConnection = await RemoteBriefcaseConnection.open(contextId, iModelId, openMode ? openMode : OpenMode.Readonly, changeSetId ? IModelVersion.asOfChangeSet(changeSetId) : IModelVersion.latest()); // eslint-disable-line deprecation/deprecation
      return iModelConnection;
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
  }

  /** Get the thumbnail for the iModel */
  public async getThumbnail(contextId: string, iModelId: GuidString): Promise<string | undefined> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    try {
      const pngImage = await this._hubClient.thumbnails.download(requestContext, iModelId, { contextId, size: "Small" });
      return pngImage;
    } catch (err) {
      // No image available
    }
    return undefined;
  }

  /** Get versions (top 5 for testing) for the iModel */
  public async getVersions(iModelId: GuidString): Promise<VersionInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const versionInfos: VersionInfo[] = [];
    try {
      const versions: Version[] = await this._hubClient.versions.get(requestContext, iModelId, new VersionQuery().select("*").top(5));
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
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const changeSetInfos: ChangeSetInfo[] = [];
    try {
      const changesets: ChangeSet[] = await this._hubClient.changeSets.get(requestContext, iModelId, new ChangeSetQuery().top(5).latest());
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
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: HubUserInfo[] = await this._hubClient.users.get(requestContext, iModelId, new UserInfoQuery().select("*"));
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
    const requestContext = await AuthorizedFrontendRequestContext.create();
    const userInfos: IModelUserInfo[] = [];
    try {
      const users: HubUserInfo[] = await this._hubClient.users.get(requestContext, iModelId, new UserInfoQuery().byId(userId));
      for (const userInfo of users) {
        userInfos.push(this.createUserInfo(userInfo));
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }
    return userInfos;
  }

  private createIModelInfo(thisIModel: HubIModel, thisProjectInfo: ProjectInfo): IModelInfo {
    const createDate: Date = new Date(thisIModel.createdDate!);
    Logger.logTrace(UiFramework.loggerCategory(this), `Working on iModel '${thisIModel.name}'`);
    const thisIModelInfo: IModelInfo = new IModelInfoImpl(thisIModel.name!, thisIModel.description!, thisIModel.wsgId, createDate, thisProjectInfo, "", thisIModel.thumbnail);
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
