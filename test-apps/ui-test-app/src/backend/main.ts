/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { app as electron } from "electron";
import * as fs from "fs";
import * as path from "path";
import { Config, Logger } from "@bentley/bentleyjs-core";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";
import getSupportedRpcs from "../common/rpcs";
import { initializeLogging } from "./web/BackendServer";

(async () => { // tslint:disable-line:no-floating-promises
  try {
    // Load .env file first so it's added to `Config.App` below when it parses the environment variables.
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      require("dotenv-expand")(
        require("dotenv").config(),
      );
    }

    IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

    if (!electron) {
      initializeLogging();
    }

    // initialize imodeljs-backend
    await IModelHost.startup();

    // initialize presentation-backend
    Presentation.initialize({
      // Specify location of where application's presentation rule sets are located.
      // May be omitted if application doesn't have any presentation rules.
      rulesetDirectories: [path.join("assets", "presentation_rules")],
      enableSchemasPreload: true,
      updatesPollInterval: 100,
    });

    // invoke platform-specific initialization
    // get platform-specific initialization function
    let init: (rpcs: RpcInterfaceDefinition[]) => void;
    if (electron) {
      init = (await import("./electron/ElectronMain")).default;
    } else {
      init = (await import("./web/BackendServer")).default;
    }
    // get RPCs supported by this backend
    const rpcs = getSupportedRpcs();
    // do initialize
    init(rpcs);
  } catch (error) {
    Logger.logError("ui-test-app", error);
    process.exitCode = 1;
  }
})();
