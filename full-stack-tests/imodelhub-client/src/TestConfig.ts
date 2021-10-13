/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
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

/** Basic configuration used by all tests
 */
export class TestConfig {
  /** Name of iTwin used by most tests */
  public static readonly iTwinName: string = process.env.IMJS_TEST_PROJECT_NAME ?? "iModelJsIntegrationTest";
  public static readonly assetName: string = process.env.IMJS_TEST_ASSET_NAME ?? "iModelJsAssetTest";
  public static readonly enableMocks: boolean = process.argv.includes("--enableMocks");
  public static readonly enableIModelBank: boolean = process.env.IMJS_TEST_IMODEL_BANK !== undefined && !!JSON.parse(process.env.IMJS_TEST_IMODEL_BANK);
  public static readonly initializeiModelTimeout: number = 15 * 60 * 1000; // 15min
}
