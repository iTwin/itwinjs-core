/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { ConnectClient, AccessToken, Project, IModelHubClient } from "@bentley/imodeljs-clients";
import { ActivityLoggingContext, Guid } from "@bentley/bentleyjs-core";
import { IModelApp } from "@bentley/imodeljs-frontend";
import { showStatus } from "./Utils";
import { SimpleViewState } from "./SimpleViewState";

/** Parameters for starting display-test-app with a specified initial configuration */

export enum ProjectScope {
  Favorites,
  MostRecentlyUsed,
  Invited,
  All,
}

// Logic to establish a connection to a Connect-hosted project and iModel
let _connectClient!: ConnectClient;

async function getProjectByName(accessToken: AccessToken, projectName: string): Promise<Project | undefined> {
  let project: Project;
  try {
    project = await _connectClient.getProject(new ActivityLoggingContext(Guid.createValue()), accessToken, { $filter: `Name+eq+'${projectName}'` });
  } catch (e) {
    console.log(`Project with name "${projectName}" does not exist`); // tslint:disable-line:no-console
    return undefined;
  }

  return project;
}

export async function initializeIModelHub(state: SimpleViewState): Promise<void> {
  _connectClient = new ConnectClient();

  showStatus("opening Project", state.projectConfig!.projectName);
  state.project = await getProjectByName(state.accessToken!, state.projectConfig!.projectName);

  IModelApp.iModelClient = new IModelHubClient();
}
