/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { app as electron } from "electron";
import { Logger, Config } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition, RpcConfiguration } from "@bentley/imodeljs-common";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import rpcs from "../common/Rpcs";
import "./SampleRpcImpl"; // just to get the RPC implementation registered

// __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization
import { Presentation, PresentationManagerMode } from "@bentley/presentation-backend";
// __PUBLISH_EXTRACT_END__

(async () => { // tslint:disable-line:no-floating-promises
  IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

  // initialize logging
  Logger.initializeToConsole();

  // initialize imodeljs-backend
  await IModelHost.startup();

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization2
  // initialize presentation-backend
  Presentation.initialize({
    rulesetDirectories: [path.join("assets", "presentation_rules")],
    localeDirectories: [path.join("assets", "locales")],
    mode: PresentationManagerMode.ReadOnly,
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
})();
