/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Config } from "@bentley/bentleyjs-core";
import { RequestGlobalOptions } from "@bentley/itwin-client";
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

loadEnv(path.join(__dirname, "..", ".env"));
// Increase the timeout since iModel creation is taking longer
RequestGlobalOptions.timeout.response = 60 * 1000; // 60 seconds in ms

function isOfflineSet(): boolean {
  const index = process.argv.indexOf("--offline");
  return process.argv[index + 1] === "mock";
}

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of project used by most tests */
  public static readonly projectName: string = Config.App.get("imjs_test_project_name", "iModelJsIntegrationTest");
  public static readonly assetName: string = Config.App.get("imjs_test_asset_name", "iModelJsAssetTest");
  public static readonly enableMocks: boolean = isOfflineSet();
  public static readonly enableIModelBank: boolean = Config.App.has("imjs_test_imodel_bank") && !!JSON.parse(Config.App.get("imjs_test_imodel_bank"));
  public static readonly initializeiModelTimeout: number = 15 * 60 * 1000; // 15min
}
