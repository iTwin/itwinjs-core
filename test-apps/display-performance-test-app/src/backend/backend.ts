/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import { ProcessDetector } from "@itwin/core-bentley";
import { ElectronHost } from "@itwin/core-electron/lib/cjs/ElectronBackend";
import { ElectronMainAuthorization } from "@itwin/electron-authorization/Main";
import { IModelHost, IModelHostOptions } from "@itwin/core-backend";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { AuthorizationClient, IModelReadRpcInterface, IModelTileRpcInterface } from "@itwin/core-common";
import { TestBrowserAuthorizationClient } from "@itwin/oidc-signin-tool";
import { AzureClientStorage, BlockBlobClientWrapperFactory } from "@itwin/object-storage-azure";
import DisplayPerfRpcInterface from "../common/DisplayPerfRpcInterface";
import "./DisplayPerfRpcImpl"; // just to get the RPC implementation registered

/** Loads the provided `.env` file into process.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

export async function initializeBackend() {
  loadEnv(path.join(__dirname, "..", "..", ".env"));

  const iModelHost: IModelHostOptions = { profileName: "display-performance-test-app" };
  const iModelClient = new IModelsClient({
    api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` },
    cloudStorage: new AzureClientStorage(new BlockBlobClientWrapperFactory())
  });
  iModelHost.hubAccess = new BackendIModelsAccess(iModelClient);
  iModelHost.cacheDir = process.env.BRIEFCASE_CACHE_LOCATION;
  iModelHost.authorizationClient = await initializeAuthorizationClient();

  if (ProcessDetector.isElectronAppBackend) {
    const rpcInterfaces = [DisplayPerfRpcInterface, IModelTileRpcInterface, IModelReadRpcInterface];
    await ElectronHost.startup({
      electronHost: {
        webResourcesPath: path.join(__dirname, "..", "..", "lib"),
        rpcInterfaces,
      },
      iModelHost,
    });
    if (iModelHost.authorizationClient)
      await (iModelHost.authorizationClient as ElectronMainAuthorization).signInSilent();
  } else
    await IModelHost.startup(iModelHost);
}

async function initializeAuthorizationClient(): Promise<AuthorizationClient | undefined> {
  if (process.env.IMJS_OIDC_HEADLESS) {
    const envVars = getEnvVars(
      "IMJS_OIDC_CLIENT_ID",
      "IMJS_OIDC_REDIRECT_URI",
      "IMJS_OIDC_SCOPE",
      "IMJS_OIDC_EMAIL",
      "IMJS_OIDC_PASSWORD",
    );
    if (undefined === envVars)
      return undefined;
    const [clientId, redirectUri, scope, email, password] = envVars;
    return new TestBrowserAuthorizationClient({
      clientId,
      redirectUri,
      scope,
      clientSecret: process.env.IMJS_OIDC_CLIENT_SECRET,
    }, {
      email,
      password,
    });
  } else {
    const envVars = getEnvVars("IMJS_OIDC_CLIENT_ID", "IMJS_OIDC_SCOPE");
    if (undefined === envVars)
      return undefined;
    const [clientId, scope] = envVars;
    if (ProcessDetector.isElectronAppBackend) {
      return new ElectronMainAuthorization({
        clientId,
        scopes: scope,
        redirectUris: process.env.IMJS_OIDC_REDIRECT_URI !== undefined ? [process.env.IMJS_OIDC_REDIRECT_URI] : ["http://localhost:3000/signin-callback"],
      });
    }
  }
  return undefined;
}
/**
 * Logs a warning if only some are provided.
 * @returns all requested values if every key is present, or undefined if any are missing.
 */
function getEnvVars(...keys: Array<string>): string[] | undefined {
  const missing: string[] = [];
  const values: string[] = [];
  for (const name of keys) {
    const value = process.env[name];
    if (value === undefined)
      missing.push(name);
    else
      values.push(value);
  }

  if (missing.length === 0)
    return values;

  if (missing.length < keys.length) { // Some missing, warn
    // eslint-disable-next-line no-console
    console.log(`Skipping auth setup due to missing: ${missing.join(", ")}`);
  }
  return undefined;
}
