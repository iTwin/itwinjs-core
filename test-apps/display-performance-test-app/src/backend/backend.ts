/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { IModelHost, IModelHostConfiguration } from "@itwin/core-backend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { IModelReadRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { TestBrowserAuthorizationClient, TestBrowserAuthorizationClientConfiguration, TestUserCredentials } from "@itwin/oidc-signin-tool";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered

export async function initializeBackend() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"; // (needed temporarily to use self-signed cert to communicate with iModelBank via https)

  const iModelHost = new IModelHostConfiguration();
  const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels`}});
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);

  iModelHost.authorizationClient = setupAuthorizationClient();
  // TODO
  try { await (iModelHost.authorizationClient as TestBrowserAuthorizationClient).signIn();  }
  catch(e) {
    console.log(JSON.stringify(e));
    throw e;
  }
  console.log("signed in");
  
  if (ProcessDetector.isElectronAppBackend) {
    const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, SnapshotIModelRpcInterface, IModelReadRpcInterface];
    await ElectronHost.startup({
      electronHost: {
        webResourcesPath: path.join(__dirname, "..", "..", "build"),
        rpcInterfaces,
      },
      iModelHost,
    });
  } else
    await IModelHost.startup(iModelHost);
}

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

function setupAuthorizationClient(): TestBrowserAuthorizationClient | undefined {
  const authConfig: TestBrowserAuthorizationClientConfiguration = {
    clientId: process.env.IMJS_OIDC_CLIENT_ID!,
    redirectUri: process.env.IMJS_OIDC_REDIRECT_URI!,
    scope: process.env.IMJS_OIDC_SCOPES!,
    authority: process.env.IMJS_OIDC_AUTHORITY
  };
  const authCredentials: TestUserCredentials = {
    email: process.env.IMJS_OIDC_EMAIL!,
    password: process.env.IMJS_OIDC_PASSWORD!
  };

  const allArgs = Object.entries({...authConfig, ...authCredentials});
  const missingKeys = allArgs.filter(([_key, val]) => !val).map(([key, _val]) => key);
  if(missingKeys.length === 0)
    return new TestBrowserAuthorizationClient(authConfig, authCredentials);
  else {
    if(missingKeys.length === allArgs.length)
      return undefined;

    throw new Error(`Missing env configuration for OIDC keys: ${ missingKeys.join(' ') }`);
  }
}