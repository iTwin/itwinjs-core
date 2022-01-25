/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { ElectronHost, ElectronHostOptions } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { RpcInterfaceDefinition } from "@itwin/core-common";
import { SampleIpcHandler } from "../SampleIpcHandler";
import { IModelHostConfiguration } from "@itwin/core-backend";

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
  const authClient = await ElectronMainAuthorization.create({
    clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "",
    redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI ?? "",
    scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "",

  });
  iModelHost.authorizationClient = authClient;

  await ElectronHost.startup({ electronHost, iModelHost });
  await ElectronHost.openMainWindow();

  // __PUBLISH_EXTRACT_END__
}
