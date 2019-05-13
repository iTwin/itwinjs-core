/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { app as electron } from "electron";
import { IModelHost } from "@bentley/imodeljs-backend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { Presentation } from "@bentley/presentation-backend";
import getSupportedRpcs from "../common/rpcs";

import { Config } from "@bentley/imodeljs-clients";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { initializeLogging, setupSnapshotConfiguration } from "./web/BackendServer";

IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

if (!electron) {
  initializeLogging();
  setupSnapshotConfiguration();
}

// initialize imodeljs-backend
IModelHost.startup();

// initialize presentation-backend
Presentation.initialize({
  // Specify location of where application's presentation rule sets are located.
  // May be omitted if application doesn't have any presentation rules.
  rulesetDirectories: [path.join("assets", "presentation_rules")],
});

// invoke platform-specific initialization
(async () => { // tslint:disable-line:no-floating-promises
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
})();
