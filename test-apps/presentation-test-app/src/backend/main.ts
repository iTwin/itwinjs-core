/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./SampleRpcImpl"; // just to get the RPC implementation registered
import { app as electron } from "electron";
import * as path from "path";
import { Logger, LogLevel } from "@bentley/bentleyjs-core";
import { loadEnv } from "@bentley/config-loader";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcConfiguration, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
// __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization
import { RequestPriority } from "@bentley/presentation-common";
import { Presentation, PresentationManagerMode } from "@bentley/presentation-backend";
import rpcs from "../common/Rpcs";
// __PUBLISH_EXTRACT_END__
import { PresentationBackendLoggerCategory, PresentationBackendNativeLoggerCategory } from "@bentley/presentation-backend"; // eslint-disable-line no-duplicate-imports

(async () => { // eslint-disable-line @typescript-eslint/no-floating-promises
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  // initialize logging
  Logger.initializeToConsole();
  Logger.setLevelDefault(LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECObjects, LogLevel.Warning);
  Logger.setLevel(PresentationBackendNativeLoggerCategory.ECPresentation, LogLevel.Info);
  Logger.setLevel(PresentationBackendLoggerCategory.Package, LogLevel.Info);

  // initialize imodeljs-backend
  await IModelHost.startup();

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization2
  // initialize presentation-backend
  Presentation.initialize({
    rulesetDirectories: [path.join("assets", "presentation_rules")],
    localeDirectories: [path.join("assets", "locales")],
    mode: PresentationManagerMode.ReadOnly,
    taskAllocationsMap: {
      [RequestPriority.Max]: 1,
    },
    useMmap: true,
  });
  // __PUBLISH_EXTRACT_END__

  // invoke platform-specific initialization
  RpcConfiguration.developmentMode = true;
  // get platform-specific initialization function
  let init: (_rpcs: RpcInterfaceDefinition[]) => void;
  if (electron) {
    init = (await import("./electron/ElectronMain")).default;
  } else {
    init = (await import("./web/BackendServer")).default;
  }
  // do initialize
  init(rpcs);

  console.log(`Process ID: ${process.pid}`); // eslint-disable-line no-console
})();
