/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { OpenMode } from "@bentley/bentleyjs-core";
import { ProjectInfo } from "./ProjectServices";
import { IModelConnection } from "@bentley/imodeljs-frontend";

/** Enumeration for iModel scope
 * @internal
 */
export enum IModelScope {
  Favorites,
  MostRecentlyUsed,
  All,
}

/** Interface for iModel information
 * @internal
 */
export interface IModelInfo {
  name: string;
  description: string;
  wsgId: string;
  createdDate: Date;
  thumbnail?: string;
  projectInfo: ProjectInfo;
  status: string;
}

/** Interface for iModel version information
 * @internal
 */
export interface VersionInfo {
  name: string;
  description: string;
  createdDate: Date;
  userCreated?: string;
  changeSetId?: string;
  smallThumbnail?: string;
  largeThumbnail?: string;
}

/** Interface for iModel change set information
 * @internal
 */
export interface ChangeSetInfo {
  name: string;
  description: string;
  pushDate: Date;
  userCreated?: string;
  changeSetId?: string;
  smallThumbnail?: string;
  largeThumbnail?: string;
}

/** Interface for iModel user information
 * @internal
 */
export interface IModelUserInfo {
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
}

/** Interface for iModel services
 * @internal
 */
export interface IModelServices {

  /** Get the iModels in a project. */
  getIModels(projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]>;

  /** Open the specified version of the IModel */
  openIModel(contextId: string, iModelId: string, openMode?: OpenMode, changeSetId?: string): Promise<IModelConnection>;

  /** Get the thumbnail for the iModel. */
  getThumbnail(projectId: string, iModelId: string): Promise<string | undefined>;

  /** Get the versions for the iModel. */
  getVersions(iModelId: string): Promise<VersionInfo[]>;

  /** Get the changesets for the iModel. */
  getChangeSets(iModelId: string): Promise<ChangeSetInfo[]>;

  /** Get the users that have access to a particular iModel. */
  getUsers(iModelId: string): Promise<IModelUserInfo[]>;

  /** Get the users that have access to a particular iModel. */
  getUser(iModelId: string, userId: string): Promise<IModelUserInfo[]>;

}
