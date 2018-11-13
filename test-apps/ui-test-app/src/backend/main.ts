/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { app as electron } from "electron";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";
import getSupportedRpcs from "../common/rpcs";

IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

// initialize logging
Logger.initializeToConsole();

// initialize imodeljs-backend
IModelHost.startup();

// initialize presentation-backend
Presentation.initialize({
  // Specify location of where application's presentation rule sets are located.
  // May be omitted if application doesn't have any presentation rules.
  rulesetDirectories: [path.join("assets", "presentation_rules")],
});

// invoke platform-specific initialization
(async () => {
  // get platform-specific initialization function
  let init: (rpcs: RpcInterfaceDefinition[]) => void;
  if (electron) {
    init = (await import("./electron/ElectronMain")).default;
  } else {
    init = (await import("./web/WebServer")).default;
  }
  // get RPCs supported by this backend
  const rpcs = getSupportedRpcs();
  // do initialize
  init(rpcs);
})();
