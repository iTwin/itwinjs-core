/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ConnectClient, AccessToken, Project, ConnectRequestQueryOptions } from "@bentley/imodeljs-clients";

export type DeploymentEnv = "DEV" | "QA";

export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

export class ProjectApi {
  private static _connectClient: ConnectClient;

  /** Deployment environment to use for Connect and iModelHub */
  public static hubDeploymentEnv: DeploymentEnv = "QA";

  // Initialize the project Api
  public static async init(): Promise<void> {
    ProjectApi._connectClient = new ConnectClient(ProjectApi.hubDeploymentEnv);
  }

  public static async getProjectByName(accessToken: AccessToken, projectScope: ProjectScope, projectName: string): Promise<Project | undefined> {

    const queryOptions: ConnectRequestQueryOptions = {
      $select: "*", // TODO: Get Name,Number,AssetType to work
      $top: 100,
      $skip: 0,
    };

    let projectList: Project[] = [];
    if (projectScope === ProjectScope.Invited) {
      projectList = await ProjectApi._connectClient.getInvitedProjects(accessToken, queryOptions);
    }

    if (projectScope === ProjectScope.Favorites) {
      queryOptions.isFavorite = true;
    } else if (projectScope === ProjectScope.MostRecentlyUsed) {
      queryOptions.isMRU = true;
    }

    projectList = await ProjectApi._connectClient.getProjects(accessToken, queryOptions);

    for (const thisProject of projectList) {
      if (thisProject.name === projectName)
        return thisProject;
    }
    return undefined;
  }
}
