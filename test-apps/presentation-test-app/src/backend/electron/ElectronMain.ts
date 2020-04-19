/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { RpcInterfaceDefinition, ElectronRpcManager } from "@bentley/imodeljs-common";
import { IModelJsElectronManager, WebpackDevServerElectronManager } from "@bentley/electron-manager";

/**
 * Initializes Electron backend
 */
export default async function initialize(rpcs: RpcInterfaceDefinition[]) {
  // tell ElectronRpcManager which RPC interfaces to handle
  // __PUBLISH_EXTRACT_START__ Presentation.Backend.RpcInterface
  ElectronRpcManager.initializeImpl({}, rpcs);
  // __PUBLISH_EXTRACT_END__

  const app = (process.env.NODE_ENV === "development") ? new WebpackDevServerElectronManager() : new IModelJsElectronManager(`${__dirname}/../../../build`);
  return app.initialize();
}
