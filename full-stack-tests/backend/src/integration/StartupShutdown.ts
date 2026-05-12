/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Logger, LogLevel } from "@itwin/core-bentley";
import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { AzureClientStorage, BlockBlobClientWrapperFactory } from "@itwin/object-storage-azure";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { emptyDirSync, mkdirsSync } from "fs-extra";
import * as fs from "fs";
import * as path from "path";

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

loadEnv(path.join(__dirname, "..", "..", "..", ".env"));

function shouldLogToConsole(): boolean {
  return process.env.ITWINJS_BACKEND_INTEGRATION_TEST_LOG_TO_CONSOLE === "1";
}

export function setupIntegrationLogging() {
  if (shouldLogToConsole())
    Logger.initializeToConsole();
  else
    Logger.initialize();

  Logger.setLevelDefault(LogLevel.Error);
}

export async function startupForIntegration(cfg?: IModelHostOptions) {
  cfg = cfg ?? {};
  cfg.cacheDir = path.join(__dirname, ".cache");  // Set the cache dir to be under the lib directory.
  const iModelClient = new IModelsClient({
    cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory()),
    api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` }
  });
  cfg.hubAccess = new BackendIModelsAccess(iModelClient);
  mkdirsSync(cfg.cacheDir);
  emptyDirSync(cfg.cacheDir);
  setupIntegrationLogging();
  return IModelHost.startup(cfg);
}
before(async () => {
  return startupForIntegration();
});

after(async () => {
  return IModelHost.shutdown();
});
