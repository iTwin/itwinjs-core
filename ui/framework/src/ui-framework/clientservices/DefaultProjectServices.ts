/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClientServices
 */

import { Logger } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, ContextRegistryRequestQueryOptions, Project } from "@bentley/context-registry-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework.js";
import { ProjectInfo, ProjectReadStatus, ProjectScope, ProjectServices } from "./ProjectServices.js";

// istanbul ignore next
class ProjectInfoImpl implements ProjectInfo {
  public readStatus: ProjectReadStatus;

  constructor(public name: string, public projectNumber: string, public wsgId: string) {
    this.readStatus = ProjectReadStatus.NotRead;
  }
}

/**
 * Provides default [[ProjectServices]]
 * @internal
 */
// istanbul ignore next
export class DefaultProjectServices implements ProjectServices {
  private _connectClient: ContextRegistryClient;

  constructor() {
    this._connectClient = new ContextRegistryClient();
  }

  private createProjectInfo(thisProject: Project): ProjectInfo {
    Logger.logTrace(UiFramework.loggerCategory(this), `Working on project '${thisProject.name}'`);
    const thisProjectInfo: ProjectInfo = new ProjectInfoImpl(thisProject.name ? thisProject.name : "", thisProject.number ? thisProject.number : "", thisProject.wsgId);
    return thisProjectInfo;
  }

  /** Get projects accessible to the user based on various scopes/criteria */
  public async getProjects(projectScope: ProjectScope, top: number, skip: number, filter?: string): Promise<ProjectInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    const queryOptions: ContextRegistryRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: top,
      $skip: skip,
      $filter: filter,
    };

    let projectList: Project[];
    try {
      if (projectScope === ProjectScope.Invited) {
        projectList = await this._connectClient.getInvitedProjects(requestContext, queryOptions);
      } else {
        if (projectScope === ProjectScope.Favorites) {
          queryOptions.isFavorite = true;
        } else if (projectScope === ProjectScope.MostRecentlyUsed) {
          queryOptions.isMRU = true;
        }
        projectList = await this._connectClient.getProjects(requestContext, queryOptions);
      }
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }

    const projects: ProjectInfo[] = [];
    for (const thisProject of projectList) {
      projects.push(this.createProjectInfo(thisProject));
    }
    return projects;
  }
}
