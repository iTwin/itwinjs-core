/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./SampleRpcImpl"; // just to get the RPC implementation registered
import { app as electron } from "electron";
import * as fs from "fs";
import * as path from "path";
import { Logger, LogLevel } from "@itwin/core-bentley";
import { RpcInterfaceDefinition } from "@itwin/core-common";
// __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization.Imports
import { Presentation, PresentationProps } from "@itwin/presentation-backend";
// __PUBLISH_EXTRACT_END__
// eslint-disable-next-line no-duplicate-imports
import { PresentationBackendLoggerCategory, PresentationBackendNativeLoggerCategory, PresentationManagerMode } from "@itwin/presentation-backend";
import rpcs from "../common/Rpcs";

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation, LogLevel.Info);
  Logger.setLevel(PresentationBackendLoggerCategory.Package, LogLevel.Info);

  // get platform-specific initialization function
  let init: (_rpcs: RpcInterfaceDefinition[]) => void;
  if (electron) {
    init = (await import("./electron/ElectronMain")).default;
  } else {
    init = (await import("./web/BackendServer")).default;
  }
  // do initialize
  init(rpcs);

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization.Props
  // set up props for the presentation backend
  const presentationBackendProps: PresentationProps = {
    rulesetDirectories: [path.join("assets", "presentation_rules")],
    localeDirectories: [path.join("assets", "locales")],
  };
  // __PUBLISH_EXTRACT_END__

  // props that we don't want to show in documentation set up example
  presentationBackendProps.mode = PresentationManagerMode.ReadWrite;
  presentationBackendProps.workerThreadsCount = 1;
  presentationBackendProps.useMmap = true;
  presentationBackendProps.updatesPollInterval = 20;

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization
  // initialize presentation backend
  Presentation.initialize(presentationBackendProps);
  // __PUBLISH_EXTRACT_END__

  console.log(`Process ID: ${process.pid}`); // eslint-disable-line no-console
})();

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
