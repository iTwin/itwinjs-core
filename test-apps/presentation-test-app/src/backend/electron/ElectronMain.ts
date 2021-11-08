/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { ElectronHost, ElectronHostOptions } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { RpcInterfaceDefinition } from "@itwin/core-common";
import { SampleIpcHandler } from "../SampleIpcHandler";

/**
 * Initializes Electron backend
 */
export default async function initialize(rpcInterfaces: RpcInterfaceDefinition[]) {
  // __PUBLISH_EXTRACT_START__ Presentation.Backend.Electron.RpcInterface

  const electronHost: ElectronHostOptions = {
    webResourcesPath: path.join(__dirname, "..", "..", "..", "build"),
    rpcInterfaces,
    developmentServer: process.env.NODE_ENV === "development",
    ipcHandlers: [SampleIpcHandler],
  };
  await ElectronHost.startup({ electronHost });
  await ElectronHost.openMainWindow();

  // __PUBLISH_EXTRACT_END__
}
