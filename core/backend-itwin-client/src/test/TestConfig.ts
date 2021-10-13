/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { AccessToken, GuidString } from "@itwin/core-bentley";
import { ITwin, ITwinAccessClient, ITwinSearchableProperty } from "@bentley/itwin-registry-client";
import { HubIModel, IModelClient, IModelHubClient, IModelQuery } from "@bentley/imodelhub-client";
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
  /** Query for the specified iTwin */
  public static async getITwinIdByName(accessToken: AccessToken, name: string): Promise<string> {
    const iTwinAccessClient = new ITwinAccessClient();
    const iTwinList: ITwin[] = await iTwinAccessClient.getAll(accessToken, {
      search: {
        searchString: name,
        propertyName: ITwinSearchableProperty.Name,
        exactMatch: true,
      },
    });

    if (iTwinList.length === 0) {
      throw new Error(`ITwin ${name} not found for user.`);
    } else if (iTwinList.length > 1) {
      throw new Error(`Multiple iTwins named ${name} were found for user.`);
    }

    return iTwinList[0].id;
  }

  /** Query for the specified iModel */
  public static async queryIModelId(accessToken: AccessToken, iModelName: string, iTwinId: GuidString): Promise<string> {
    const imodelHubClient: IModelClient = new IModelHubClient();
    const iModel: HubIModel = (await imodelHubClient.iModels.get(accessToken, iTwinId, new IModelQuery().byName(iModelName)))[0];
    if (!iModel || !iModel.wsgId || iModel.name !== iModelName) {
      throw new Error(`iModel ${iModelName} not found for iTwin ${iTwinId} for user.`);
    }

    return iModel.wsgId;
  }
}
