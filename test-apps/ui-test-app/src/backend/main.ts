/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { BackendApplicationInsightsClient } from "@bentley/backend-application-insights-client";
import { Config, Logger, ProcessDetector } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { Presentation } from "@bentley/presentation-backend";
import { initializeLogging, initializeWeb } from "./web/BackendServer";
import { initializeElectron } from "./electron/ElectronMain";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  try {
    // Load .env file first so it's added to `Config.App` below when it parses the environment variables.
    if (fs.existsSync(path.join(process.cwd(), ".env"))) {
      require("dotenv-expand")( // eslint-disable-line @typescript-eslint/no-var-requires
        require("dotenv").config(), // eslint-disable-line @typescript-eslint/no-var-requires
      );
    }

    if (!ProcessDetector.isElectronAppBackend) {
      initializeLogging();
    }

    const iModelJsApplicationInsightsKey = Config.App.getString("imjs_telemetry_application_insights_instrumentation_key", "");
    if (iModelJsApplicationInsightsKey) {
      const applicationInsightsClient = new BackendApplicationInsightsClient({ applicationInsightsKey: iModelJsApplicationInsightsKey, backendMachineName: os.hostname(), backendApplicationId: IModelHost.applicationId, backendApplicationVersion: IModelHost.applicationVersion, clientAuthManager: IModelHost.clientAuthIntrospectionManager });
      IModelHost.telemetry.addClient(applicationInsightsClient);
    }

    // invoke platform-specific initialization
    if (ProcessDetector.isElectronAppBackend) {
      await initializeElectron();
    } else {
      await initializeWeb();
    }

    // initialize presentation-backend
    Presentation.initialize({
      // Specify location of where application's presentation rule sets are located.
      // May be omitted if application doesn't have any presentation rules.
      rulesetDirectories: [path.join("assets", "presentation_rules")],
      enableSchemasPreload: true,
      updatesPollInterval: 100,
    });
  } catch (error) {
    Logger.logError("ui-test-app", error);
    process.exitCode = 1;
  }
})();
