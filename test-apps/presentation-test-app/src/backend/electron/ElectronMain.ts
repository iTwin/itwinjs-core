/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as electron from "electron";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronAppManager } from "@bentley/imodeljs-backend";

/**
 * Initializes Electron backend
 */
export default function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell ElectronRpcManager which RPC interfaces to handle
  // __PUBLISH_EXTRACT_START__ Presentation.Backend.RpcInterface
  ElectronRpcManager.initializeImpl({}, rpcs);
  // __PUBLISH_EXTRACT_END__

  const app = new IModelJsElectronAppManager(electron);
  return app.initialize();
}
