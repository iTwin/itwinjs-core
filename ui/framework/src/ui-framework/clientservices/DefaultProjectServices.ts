/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module ClientServices
 */

import { Logger } from "@bentley/bentleyjs-core";
import { RequestQueryOptions } from "@bentley/itwin-client";
import { ContextRegistryClient, ITwin } from "@bentley/context-registry-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { UiFramework } from "../UiFramework";
import { ProjectInfo, ProjectReadStatus, ProjectScope, ProjectServices } from "./ProjectServices";

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

  private createProjectInfo(thisProject: ITwin): ProjectInfo {
    Logger.logTrace(UiFramework.loggerCategory(this), `Working on project '${thisProject.name}'`);
    const thisProjectInfo: ProjectInfo = new ProjectInfoImpl(thisProject.name ? thisProject.name : "", thisProject.iTwinNumber ? thisProject.iTwinNumber : "", thisProject.id);
    return thisProjectInfo;
  }

  /** Get projects accessible to the user based on various scopes/criteria */
  public async getProjects(projectScope: ProjectScope, top: number, skip: number, filter?: string): Promise<ProjectInfo[]> {
    const requestContext = await AuthorizedFrontendRequestContext.create();

    const queryOptions: RequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: top,
      $skip: skip,
      $filter: filter,
    };

    // SWB DEBUG: Useless lines, used to force compiler to work
    queryOptions.$top = top;
    projectScope = projectScope.valueOf();
    // SWB END DEBUG LINES

    let containerList: ITwin[];
    try {
      containerList = await this._connectClient.getITwins(requestContext);
    } catch (e) {
      alert(JSON.stringify(e));
      throw e;
    }

    const projects: ProjectInfo[] = [];
    for (const thisProject of containerList) {
      projects.push(this.createProjectInfo(thisProject));
    }
    return projects;
  }
}
