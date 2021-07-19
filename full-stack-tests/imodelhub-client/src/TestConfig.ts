/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { Config } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { RequestGlobalOptions } from "@bentley/itwin-client";

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
