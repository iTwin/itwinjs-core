/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { app as electron } from "electron";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import rpcs from "../common/Rpcs";
import "./SampleRpcImpl"; // just to get the RPC implementation registered

// initialize logging
Logger.initializeToConsole();

// initialize imodeljs-backend
IModelHost.startup();

// __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization
import { Presentation } from "@bentley/presentation-backend";
Presentation.initialize({
  rulesetDirectories: [path.join("assets", "presentation_rules")],
  localeDirectories: [path.join("assets", "locales")],
});
// __PUBLISH_EXTRACT_END__

// invoke platform-specific initialization
(async () => {
  // get platform-specific initialization function
  let init: (rpcs: RpcInterfaceDefinition[]) => void;
  if (electron) {
    init = (await import("./electron/ElectronMain")).default;
  } else {
    init = (await import("./web/WebServer")).default;
  }
  // do initialize
  init(rpcs);
})();
