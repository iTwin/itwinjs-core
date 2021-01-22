/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { ElectronBackend, ElectronBackendOptions } from "@bentley/electron-manager/lib/ElectronBackend";
import { RpcInterfaceDefinition } from "@bentley/imodeljs-common";

/**
 * Initializes Electron backend
 */
export default async function initialize(rpcInterfaces: RpcInterfaceDefinition[]) {
  // tell ElectronRpcManager which RPC interfaces to handle

  // __PUBLISH_EXTRACT_START__ Presentation.Backend.RpcInterface

  const opts: ElectronBackendOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
    rpcInterfaces,
    developmentServer: process.env.NODE_ENV === "development",
  };

  const manager = ElectronBackend.initialize(opts);
  await manager.openMainWindow();

  // __PUBLISH_EXTRACT_END__
}
