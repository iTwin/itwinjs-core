/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelHost } from "@itwin/core-backend";
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

  if (ProcessDetector.isElectronAppBackend) {
    const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    await ElectronHost.startup({
      electronHost: {
        webResourcesPath: path.join(__dirname, "..", "..", "build"), rpcInterfaces, authConfig: {
          clientId: "imodeljs-electron-test",
          redirectUri: "http://localhost:3000/signin-callback",
          scope: "openid email profile organization itwinjs",
        },
      },
    });

    // TODO: Use this setup once the ElectronAuth is split out.
    // IModelHost.authorizationClient = new ElectronAuthorizationBackend({
    //   clientId: "imodeljs-electron-test",
    //   redirectUri: "http://localhost:3000/signin-callback",
    //   scope: "openid email profile organization itwinjs",
    // });
  } else
    await IModelHost.startup();
}
