/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { AuthorizedFrontendRequestContext } from "@bentley/imodeljs-frontend";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import { showStatus } from "./Utils";

// Logic to establish a connection to a Connect-hosted project and iModel
let connectClient!: ContextRegistryClient;

async function getProjectByName(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<Project | undefined> {
  let project: Project;
  try {
    project = await connectClient.getProject(requestContext, { $filter: `Name+eq+'${projectName}'` });
  } catch (e) {
    console.log(`Project with name "${projectName}" does not exist`); // eslint-disable-line no-console
    return undefined;
  }

  return project;
}

export async function initializeIModelHub(projectName: string): Promise<Project | undefined> {
  connectClient = new ContextRegistryClient();

  showStatus("opening Project", projectName);

  const requestContext = await AuthorizedFrontendRequestContext.create();
  const project = await getProjectByName(requestContext, projectName);

  return project;
}
