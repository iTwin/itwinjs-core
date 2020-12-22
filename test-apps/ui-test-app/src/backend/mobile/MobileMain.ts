/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelReadRpcInterface, IModelTileRpcInterface, MobileRpcManager, NativeAppRpcInterface, SnapshotIModelRpcInterface } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";
import { NativeAppBackend } from "@bentley/imodeljs-backend";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import * as fs from "fs";
import * as path from "path";
import { Config, Logger, LogLevel } from "@bentley/bentleyjs-core";
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
    IModelJsConfig.init(true /* suppress error */, true /* suppress message */, Config.App);

    // initialize imodeljs-backend
    await NativeAppBackend.startup();

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
      NativeAppRpcInterface,
    ]);
  } catch (error) {
    Logger.logError("ui-test-app", error);
    process.exitCode = 1;
  }
})();
