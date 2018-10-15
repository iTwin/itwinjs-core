/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ConnectClient, AccessToken, Project, ConnectRequestQueryOptions, IModelHubClient, ImsActiveSecureTokenClient, ImsDelegationSecureTokenClient, AuthorizationToken } from "@bentley/imodeljs-clients/lib";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { showStatus } from "./Utils";
import { SimpleViewState } from "./SimpleViewState";

/** Parameters for starting SimpleViewTest with a specified initial configuration */

export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

// Logic to establish a connection to a Connect-hosted project and iModel
let _connectClient!: ConnectClient;

async function getProjectByName(accessToken: AccessToken, projectScope: ProjectScope, projectName: string): Promise<Project | undefined> {
  const alctx = new ActivityLoggingContext(Guid.createValue());

  const queryOptions: ConnectRequestQueryOptions = {
    $select: "*", // TODO: Get Name,Number,AssetType to work
    $top: 100,
    $skip: 0,
  };

  let projectList: Project[] = [];
  if (projectScope === ProjectScope.Invited) {
    projectList = await _connectClient.getInvitedProjects(alctx, accessToken, queryOptions);
  }

  if (projectScope === ProjectScope.Favorites) {
    queryOptions.isFavorite = true;
  } else if (projectScope === ProjectScope.MostRecentlyUsed) {
    queryOptions.isMRU = true;
  }

  projectList = await _connectClient.getProjects(alctx, accessToken, queryOptions);

  for (const thisProject of projectList) {
    if (thisProject.name === projectName)
      return thisProject;
  }
  return undefined;
}

// log in to connect
async function loginToConnect(state: SimpleViewState, userName: string, password: string) {
  const alctx = new ActivityLoggingContext(Guid.createValue());
  alctx.enter();
  // tslint:disable-next-line:no-console
  console.log("Attempting login with userName", userName, "password", password);

  const authClient = new ImsActiveSecureTokenClient();
  const accessClient = new ImsDelegationSecureTokenClient();

  const authToken: AuthorizationToken = await authClient.getToken(alctx, userName, password);
  state.accessToken = await accessClient.getToken(alctx, authToken);
}

export async function initializeIModelHub(state: SimpleViewState): Promise<void> {
  showStatus("logging in as", state.projectConfig!.userName);
  await loginToConnect(state, state.projectConfig!.userName, state.projectConfig!.password);

  _connectClient = new ConnectClient();

  showStatus("opening Project", state.projectConfig!.projectName);
  state.project = await getProjectByName(state.accessToken!, ProjectScope.Invited, state.projectConfig!.projectName);

  IModelApp.iModelClient = new IModelHubClient();
}
