/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { GuidString } from "@bentley/bentleyjs-core";
import { ContextRegistryClient, Project } from "@bentley/context-registry-client";
import { HubIModel, IModelClient, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
import { AuthorizedClientRequestContext } from "@bentley/itwin-client";
import * as fs from "fs";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, "..", "..", ".env"));

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Query for the specified project */
  public static async queryProjectId(requestContext: AuthorizedClientRequestContext, projectName: string): Promise<string> {
    const contextRegistry = new ContextRegistryClient();
    const project: Project | undefined = await contextRegistry.getProject(requestContext, {
      $select: "*",
      $filter: `Name+eq+'${projectName}'`,
    });
    if (!project || !project.wsgId) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`Project ${projectName} not found for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }
    return project.wsgId;
  }

  /** Query for the specified iModel */
  public static async queryIModelId(requestContext: AuthorizedClientRequestContext, iModelName: string, projectId: GuidString): Promise<string> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = (await imodelHubClient.iModels.get(requestContext, projectId, new IModelQuery().byName(iModelName)))[0];
    if (!iModel || !iModel.wsgId || iModel.name !== iModelName) {
      const userInfo = requestContext.accessToken.getUserInfo();
      throw new Error(`iModel ${iModelName} not found for project ${projectId} for user ${!userInfo ? "n/a" : userInfo.email}.`);
    }

    return iModel.wsgId;
  }
}
