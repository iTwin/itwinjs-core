/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager } from "@bentley/electron-manager";

/**
 * Initializes Electron backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell ElectronRpcManager which RPC interfaces to handle
  ElectronRpcManager.initializeImpl({}, rpcs);

  const app = new IModelJsElectronManager(path.join(__dirname, "..", "..", "webresources"));
  return app.initialize();
}
