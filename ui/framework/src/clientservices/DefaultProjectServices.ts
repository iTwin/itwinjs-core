/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module ClientServices */

import { ConnectClient, AccessToken, Project, ConnectRequestQueryOptions, DeploymentEnv } from "@bentley/imodeljs-clients";
import { ProjectServices, ProjectScope, ProjectInfo, ProjectReadStatus } from "./ProjectServices";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";

class ProjectInfoImpl implements ProjectInfo {
  public readStatus: ProjectReadStatus;

  constructor(public name: string, public projectNumber: string, public wsgId: string) {
    this.readStatus = ProjectReadStatus.NotRead;
  }
}

/**
 * Provides default [[ProjectServices]]
 */
export class DefaultProjectServices implements ProjectServices {
  private _connectClient: ConnectClient;
  public deploymentEnv: DeploymentEnv;

  constructor(deploymentEnvironment: DeploymentEnv) {
    this.deploymentEnv = deploymentEnvironment;
    this._connectClient = new ConnectClient(deploymentEnvironment);
  }

  private createProjectInfo(thisProject: Project): ProjectInfo {
    console.log("Working on project", thisProject.name); // tslint:disable-line:no-console
    const thisProjectInfo: ProjectInfo = new ProjectInfoImpl(thisProject.name ? thisProject.name : "", thisProject.number ? thisProject.number : "", thisProject.wsgId);
    return thisProjectInfo;
  }

  /** Get projects accessible to the user based on various scopes/criteria */
  public async getProjects(accessToken: AccessToken, projectScope: ProjectScope, top: number, skip: number, filter?: string): Promise<ProjectInfo[]> {
    const alctx = new ActivityLoggingContext(Guid.createValue());

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: top,
      $skip: skip,
      $filter: filter,
    };

    let projectList: Project[];
    try {
      if (projectScope === ProjectScope.Invited) {
        projectList = await this._connectClient.getInvitedProjects(alctx, accessToken, queryOptions);
      }

      if (projectScope === ProjectScope.Favorites) {
        queryOptions.isFavorite = true;
      } else if (projectScope === ProjectScope.MostRecentlyUsed) {
        queryOptions.isMRU = true;
      }

      projectList = await this._connectClient.getProjects(alctx, accessToken, queryOptions);
    } catch (e) {
      alert(JSON.stringify(e));
      return Promise.reject(e);
    }

    const projects: ProjectInfo[] = [];
    for (const thisProject of projectList) {
      projects.push(this.createProjectInfo(thisProject));
    }
    return projects;
  }
}
