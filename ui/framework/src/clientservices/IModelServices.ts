/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
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

/** Interface for iModel services */
export interface IModelServices {

  // Get the iModels in a project.
  getIModels(accessToken: AccessToken, projectInfo: ProjectInfo, top: number, skip: number): Promise<IModelInfo[]>;

  // Open the specified version of the IModel */
  openIModel(accessToken: AccessToken, projectInfo: ProjectInfo, iModelId: string, openMode?: OpenMode, changeSetId?: string): Promise<IModelConnection>;

  // get the thumbnail for the iModel.
  getThumbnail(accessToken: AccessToken, projectId: string, iModelId: string): Promise<string | undefined>;
}
