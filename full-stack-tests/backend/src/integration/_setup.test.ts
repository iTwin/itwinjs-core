/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/IModelHubBackend";
import { IModelHostConfiguration } from "@itwin/core-backend";
import { TestUtils } from "@itwin/core-backend/lib/cjs/test";
import * as fs from "fs";
import * as path from "path";

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

/** Handles the startup of IModelHost.
   * The provided config is used and will override any of the default values used in this method.
   *
   * The default includes:
   * - concurrentQuery.current === 4
   * - cacheDir === path.join(__dirname, ".cache")
   */
// async function startBackend(config?: IModelHostConfiguration): Promise<void> {
//   const cfg = config ? config : new IModelHostConfiguration();
//   cfg.cacheDir = path.join(__dirname, ".cache");  // Set the cache dir to be under the lib directory.
//   cfg.hubAccess = IModelHubBackend;
//   return IModelHost.startup(cfg);
// }

loadEnv(path.join(__dirname, "..", "..", "..", ".env"));

before(async () => {
  await TestUtils.shutdownBackend();

  const cfg = new IModelHostConfiguration();
  cfg.cacheDir = path.join(__dirname, ".cache");  // Set the cache dir to be under the lib directory.
  cfg.hubAccess = IModelHubBackend;

  await TestUtils.startBackend(cfg);
});
