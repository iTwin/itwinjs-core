/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";
import { Logger, LogLevel, ProcessDetector } from "@bentley/bentleyjs-core";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { AndroidHost, IOSHost, MobileRpcManager } from "@bentley/mobile-manager/lib/MobileBackend";
import { Presentation } from "@bentley/presentation-backend";
import { PresentationRpcInterface } from "@bentley/presentation-common";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    // Load .env file first so it's added to `Config.App` below when it parses the environment variables.
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      require("dotenv-expand")( // eslint-disable-line @typescript-eslint/no-var-requires
        require("dotenv").config(), // eslint-disable-line @typescript-eslint/no-var-requires
      );
    }
    Logger.initializeToConsole();
    Logger.setLevelDefault(LogLevel.Trace);

    // initialize imodeljs-backend
    if (ProcessDetector.isIOSAppBackend)
      await IOSHost.startup();
    else
      await AndroidHost.startup();

    // initialize presentation-backend
    Presentation.initialize({
      // Specify location of where application's presentation rule sets are located.
      // May be omitted if application doesn't have any presentation rules.
      rulesetDirectories: [path.join("assets", "presentation_rules")],
      enableSchemasPreload: true,
      updatesPollInterval: 100,
    });

    MobileRpcManager.initializeImpl([
      IModelReadRpcInterface,
      IModelTileRpcInterface,
      SnapshotIModelRpcInterface,
      PresentationRpcInterface,
    ]);
  } catch (error) {
    Logger.logError("ui-test-app", error);
    process.exitCode = 1;
  }
})();
