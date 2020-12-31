/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { ElectronManagerOptions, IModelJsElectronManager, WebpackDevServerElectronManager } from "@bentley/electron-manager";
import { ElectronRpcManager, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { BackendIpc } from "@bentley/imodeljs-backend/lib/ipc/BackendIpc";

/**
 * Initializes Electron backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell ElectronRpcManager which RPC interfaces to handle

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.RpcInterface

  const opts: ElectronManagerOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
  };

  const manager = (process.env.NODE_ENV === "development") ?
    new WebpackDevServerElectronManager(opts) :
    new IModelJsElectronManager(opts);

  await manager.initialize();

  BackendIpc.initialize(manager);
  ElectronRpcManager.initializeImpl({}, rpcs, manager);
  // __PUBLISH_EXTRACT_END__
}
