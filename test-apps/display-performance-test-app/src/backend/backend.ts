/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/lib/cjs/ElectronMain";
import { IModelHost, IModelHostConfiguration } from "@itwin/core-backend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-var-requires
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-var-requires
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

export async function initializeBackend() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const iModelHost = new IModelHostConfiguration();
  const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`}});
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);

  if (ProcessDetector.isElectronAppBackend) {
    const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    let authClient;
    if (process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID && process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI && process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES) {
      authClient = new ElectronMainAuthorization({
        clientId: process.env.IMJS_OIDC_ELECTRON_TEST_CLIENT_ID,
        redirectUri: process.env.IMJS_OIDC_ELECTRON_TEST_REDIRECT_URI,
        scope: process.env.IMJS_OIDC_ELECTRON_TEST_SCOPES,
      });
      iModelHost.authorizationClient = authClient;
    }
    await ElectronHost.startup({
      electronHost: {
        webResourcesPath: path.join(__dirname, "..", "..", "build"),
        rpcInterfaces,
      },
      iModelHost,
    });
    await authClient.signInSilent();
  } else
    await IModelHost.startup(iModelHost);
}
