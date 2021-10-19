/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { IModelHostConfiguration } from "@itwin/core-backend";
import { Logger, ProcessDetector } from "@itwin/core-bentley";
import { Presentation } from "@itwin/presentation-backend";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { initializeLogging } from "./logging";
import { initializeWeb } from "./web/BackendServer";
import { initializeElectron } from "./electron/ElectronMain";
import { loggerCategory } from "../common/TestAppConfiguration";
import { AndroidHost, IOSHost } from "@itwin/core-mobile/lib/cjs/MobileBackend";
import { getSupportedRpcs } from "../common/rpcs";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    // Load .env file first
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      require("dotenv-expand")( // eslint-disable-line @typescript-eslint/no-var-requires
        require("dotenv").config(), // eslint-disable-line @typescript-eslint/no-var-requires
      );
    }

    initializeLogging();

    const iModelHost = new IModelHostConfiguration();
    iModelHost.hubAccess = new IModelHubBackend();

    // invoke platform-specific initialization
    if (ProcessDetector.isElectronAppBackend) {
      await initializeElectron(iModelHost);
    } else if (ProcessDetector.isIOSAppBackend) {
      await IOSHost.startup({ mobileHost: { rpcInterfaces: getSupportedRpcs() } });
    } else if (ProcessDetector.isAndroidAppBackend) {
      await AndroidHost.startup({ mobileHost: { rpcInterfaces: getSupportedRpcs() } });
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
