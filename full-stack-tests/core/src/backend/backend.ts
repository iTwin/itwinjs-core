/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import "./RpcImpl";

import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { Logger, ProcessDetector } from "@itwin/core-bentley";
import { RpcConfiguration } from "@itwin/core-common";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";
import { BasicManipulationCommand, EditCommandAdmin } from "@itwin/editor-backend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { AzureClientStorage, BlockBlobClientWrapperFactory } from "@itwin/object-storage-azure";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import * as fs from "fs";
import * as path from "path";
import { exposeBackendCallbacks } from "../certa/certaBackend";
import { rpcInterfaces } from "../common/RpcInterfaces";
import * as testCommands from "./TestEditCommands";
import { setElectronAuth } from "./BackendServer";

/* eslint-disable no-console */

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error)
    throw envResult.error;

  dotenvExpand(envResult);
}

// Electron-only backend init. Retained for Certa Electron mode and future Vitest Electron mode.
// Chrome/web mode now uses BackendServer.ts (separate process).
async function init() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  RpcConfiguration.developmentMode = true;

  const iModelHost: IModelHostOptions = {};
  const iModelClient = new IModelsClient({ cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory()), api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);
  iModelHost.cacheDir = path.join(__dirname, ".cache");

  if (ProcessDetector.isElectronAppBackend) {
    exposeBackendCallbacks();
    const electronAuth = new ElectronMainAuthorization({
      clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID ?? "testClientId",
      redirectUris: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI !== undefined ? [process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI] : ["testRedirectUri"],
      scopes: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES ?? "testScope",
    });
    await electronAuth.signInSilent();
    iModelHost.authorizationClient = electronAuth;
    await ElectronHost.startup({ electronHost: { rpcInterfaces }, iModelHost });
    await electronAuth.signInSilent();
    setElectronAuth(electronAuth);

    EditCommandAdmin.registerModule(testCommands);
    EditCommandAdmin.register(BasicManipulationCommand);
  } else {
    // Chrome/web mode should use BackendServer.ts instead — this path kept only for backward compat
    throw new Error("backend.ts is now Electron-only. Use BackendServer.ts for Chrome/web mode.");
  }

  ECSchemaRpcImpl.register();
  Logger.initializeToConsole();
}

module.exports = init();
