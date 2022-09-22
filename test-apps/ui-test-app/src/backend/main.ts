/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { Logger, ProcessDetector } from "@itwin/core-bentley";
import { MobileHost } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { Presentation } from "@itwin/presentation-backend";
import { getSupportedRpcs } from "../common/rpcs";
import { loggerCategory } from "../common/TestAppConfiguration";
import { initializeElectron } from "./electron/ElectronMain";
import { initializeLogging } from "./logging";
import { initializeWeb } from "./web/BackendServer";
import { RpcManager } from "@itwin/core-common";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    // Load .env file first
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      require("dotenv-expand")( // eslint-disable-line @typescript-eslint/no-var-requires
        require("dotenv").config(), // eslint-disable-line @typescript-eslint/no-var-requires
      );
    }

    initializeLogging();

    const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
    const iModelHost = {
      hubAccess: new BackendIModelsAccess(iModelClient),
    };

    // ECSchemaRpcInterface allows schema retrieval for the UnitProvider implementation.
    RpcManager.registerImpl(ECSchemaRpcInterface, ECSchemaRpcImpl);

    // invoke platform-specific initialization
    if (ProcessDetector.isElectronAppBackend) {
      await initializeElectron(iModelHost);
    } else if (ProcessDetector.isIOSAppBackend || ProcessDetector.isAndroidAppBackend) {
      await MobileHost.startup({ mobileHost: { rpcInterfaces: getSupportedRpcs() } });
    } else {
      await initializeWeb(iModelHost);
    }

    // initialize presentation-backend
    Presentation.initialize({
      // Specify location of where application's presentation rule sets are located.
      // May be omitted if application doesn't have any presentation rules.
      rulesetDirectories: [path.join("assets", "presentation_rules")],
      enableSchemasPreload: true,
      updatesPollInterval: 100,
    });

  } catch (error: any) {
    Logger.logError(loggerCategory, error);
    process.exitCode = 1;
  }
})();
