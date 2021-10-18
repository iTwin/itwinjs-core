/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { ElectronAuthorizationBackend } from "@itwin/electron-authorization/lib/cjs/ElectronBackend";
import { ElectronHost, ElectronHostOptions } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { RpcInterfaceDefinition } from "@itwin/core-common";
import { SampleIpcHandler } from "../SampleIpcHandler";
import { IModelHost, IModelHostConfiguration } from "@itwin/core-backend";

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
  const iModelHost = new IModelHostConfiguration();
  iModelHost.authorizationClient = new ElectronAuthorizationBackend({
    clientId: "imodeljs-electron-test",
    redirectUri: "http://localhost:3000/signin-callback",
    scope: "openid email profile organization itwinjs",
  });
  await ElectronHost.startup({ electronHost, iModelHost });
  await (IModelHost.authorizationClient as ElectronAuthorizationBackend).initialize();
  await ElectronHost.openMainWindow();

  // __PUBLISH_EXTRACT_END__
}
