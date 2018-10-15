/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import { app as electron } from "electron";
import { Logger } from "@bentley/bentleyjs-core";
import { IModelHost } from "@bentley/imodeljs-backend";
import { IModelTileRpcInterface, IModelReadRpcInterface, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { IModelJsConfig } from "@bentley/config-loader/lib/IModelJsConfig";
import { Config } from "@bentley/imodeljs-clients";
IModelJsConfig.init(true /*suppress error*/, true /* suppress message */, Config.App);

// initialize logging
Logger.initializeToConsole();

// initialize imodeljs-backend
IModelHost.startup();

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
  const rpcs = [IModelTileRpcInterface, IModelReadRpcInterface];
  // do initialize
  init(rpcs);
})();
