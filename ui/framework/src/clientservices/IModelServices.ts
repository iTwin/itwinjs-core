/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { AccessToken } from "@bentley/imodeljs-clients";
import { OpenMode } from "@bentley/bentleyjs-core/lib/BeSQLite";
import { ProjectInfo } from "./ProjectServices";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/** Enumeration for iModel scope */
export enum IModelScope {
  Favorites,
  MostRecentlyUsed,
  All,
}

/** Interface for iModel information */
export interface IModelInfo {
  name: string;
  description: string;
  wsgId: string;
  createdDate: Date;
  thumbnail?: string;
  projectInfo: ProjectInfo;
  status: string;
}

/** Interface for iModel version information */
export interface VersionInfo {
  name: string;
  description: string;
  createdDate: Date;
  userCreated?: string;
  changeSetId?: string;
  smallThumbnail?: string;
  largeThumbnail?: string;
}

/** Interface for iModel change set information */
export interface ChangeSetInfo {
  name: string;
  description: string;
  pushDate: Date;
  userCreated?: string;
  changeSetId?: string;
  smallThumbnail?: string;
  largeThumbnail?: string;
}

/** Interface for iModel user information */
export interface IModelUserInfo {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Interface for iModel services */
export interface IModelServices {

  /** Get the iModels in a project. */
  getIModels(accessToken: AccessToken, projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]>;

  /** Open the specified version of the IModel */
  openIModel(accessToken: AccessToken, projectInfo: ProjectInfo, iModelId: string, openMode?: OpenMode, changeSetId?: string): Promise<IModelConnection>;

  /** Get the thumbnail for the iModel. */
  getThumbnail(accessToken: AccessToken, projectId: string, iModelId: string): Promise<string | undefined>;

  /** Get the versions for the iModel. */
  getVersions(accessToken: AccessToken, iModelId: string): Promise<VersionInfo[]>;

  /** Get the changesets for the iModel. */
  getChangeSets(accessToken: AccessToken, iModelId: string): Promise<ChangeSetInfo[]>;

  /** Get the users that have access to a particular iModel. */
  getUsers(accessToken: AccessToken, iModelId: string): Promise<IModelUserInfo[]>;

  /** Get the users that have access to a particular iModel. */
  getUser(accessToken: AccessToken, iModelId: string, userId: string): Promise<IModelUserInfo[]>;

}
