/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { AccessToken, DeploymentEnv } from "@bentley/imodeljs-clients";

// This file defines the Project-related service interface that applications can provide if they want to override the default behavior.

/** The possible status values for reading ProjectInfo from CONNECT. */
export enum ProjectReadStatus {
  NotRead,
  Reading,
  DoneReading,
}

/** The possible values for Project scope in the CONNECT environment. */
export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

/** Information required to display a CONNECT Project to the user. */
export interface ProjectInfo {
  name: string;
  projectNumber: string;
  wsgId: string;
  readStatus: ProjectReadStatus;
}

/** Interface for Project services */
export interface ProjectServices {
  deploymentEnv: DeploymentEnv;

  // Retrieve the Projects for the specified ProjectScope to which the logged in user has access.
  // the top and skip arguments are used for paging when there are large numbers of projects.
  getProjects(accessToken: AccessToken, projectScope: ProjectScope, top: number, skip: number, filter?: string): Promise<ProjectInfo[]>;
}
