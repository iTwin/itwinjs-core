/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClientServices
 */

import { IModelConnection } from "@bentley/imodeljs-frontend";
import { GuidString } from "@bentley/bentleyjs-core";

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
  iTwinId: GuidString;
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
  getIModels(iTwinId: GuidString, top: number, skip: number): Promise<IModelInfo[]>;

  /** Open the specified version of the IModel */
  openIModel(iTwinId: string, iModelId: string, changeSetId?: string): Promise<IModelConnection>;

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
