/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { app as electron } from "electron";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition, RpcConfiguration } from "@bentley/imodeljs-common";
import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import rpcs from "../common/Rpcs";
import "./SampleRpcImpl"; // just to get the RPC implementation registered

IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

// initialize logging
Logger.initializeToConsole();

// initialize imodeljs-backend
IModelHost.startup();

// __PUBLISH_EXTRACT_START__ Presentation.Backend.Initialization
import { Presentation } from "@bentley/presentation-backend";

// initialize presentation-backend
Presentation.initialize({
  rulesetDirectories: [path.join("assets", "presentation_rules")],
  localeDirectories: [path.join("assets", "locales")],
});
// __PUBLISH_EXTRACT_END__

// invoke platform-specific initialization
(async () => { // tslint:disable-line:no-floating-promises
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
