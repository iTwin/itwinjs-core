/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { Logger, LogLevel, ProcessDetector } from "@itwin/core-bentley";
import * as path from "path";

export async function transformerTestStartup() {
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Error);
  const cfg: IModelHostOptions = {};
  if (ProcessDetector.isIOSAppBackend) {
    cfg.cacheDir = undefined; // Let the native side handle the cache.
  } else {
    cfg.cacheDir = path.join(__dirname, ".cache");  // Set the cache dir to be under the lib directory.
  }
  return IModelHost.startup(cfg);
}

before(async () => transformerTestStartup());
after(async () => IModelHost.shutdown());

