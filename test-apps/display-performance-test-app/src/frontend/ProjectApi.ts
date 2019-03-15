/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ConnectClient, Project, ConnectRequestQueryOptions } from "@bentley/imodeljs-clients";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";

export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

export class ProjectApi {
  private static _connectClient: ConnectClient;

  /** Deployment environment to use for Connect and iModelHub */

  // Initialize the project Api
  public static async init(): Promise<void> {
    ProjectApi._connectClient = new ConnectClient();
  }

  public static async getProjectByName(requestContext: AuthorizedFrontendRequestContext, projectScope: ProjectScope, projectName: string): Promise<Project | undefined> {
    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: 100,
      $skip: 0,
    };

    let projectList: Project[] = [];
    if (projectScope === ProjectScope.Invited) {
      projectList = await ProjectApi._connectClient.getInvitedProjects(requestContext, queryOptions);
    }

    if (projectScope === ProjectScope.Favorites) {
      queryOptions.isFavorite = true;
    } else if (projectScope === ProjectScope.MostRecentlyUsed) {
      queryOptions.isMRU = true;
    }

    projectList = await ProjectApi._connectClient.getProjects(requestContext, queryOptions);

    for (const thisProject of projectList) {
      if (thisProject.name === projectName)
        return thisProject;
    }
    return undefined;
  }
}
