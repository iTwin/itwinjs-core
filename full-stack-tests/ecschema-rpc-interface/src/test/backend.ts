/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Sets up a local backend to be used for testing within the iTwin.js Core repo.

import * as path from "path";
import { IModelJsExpressServer } from "@itwin/express-server";
import { IModelHost } from "@itwin/core-backend";
import { BentleyCloudRpcManager, RpcConfiguration, RpcManager } from "@itwin/core-common";
import { getRpcInterfaces } from "../common/Settings";
import * as fs from "fs";
import { IModelsClient } from "@itwin/imodels-client-authoring";
import { BackendIModelsAccess } from "@itwin/imodels-access-backend";
import { ECSchemaRpcInterface } from "@itwin/ecschema-rpcinterface-common";
import { ECSchemaRpcImpl } from "@itwin/ecschema-rpcinterface-impl";

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

loadEnv(path.join(__dirname, "..", "..", ".env"));
void (async () => {
  RpcConfiguration.developmentMode = true;

  // Start the backend
  const iModelClient = new IModelsClient({ api: { baseUrl: `https://${process.env.IMJS_URL_PREFIX ?? ""}api.bentley.com/imodels` } });
  const hubAccess = new BackendIModelsAccess(iModelClient);
  await IModelHost.startup({ hubAccess, cacheDir: path.join(__dirname, ".cache") });

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "schema-rpc-test", version: "v1.0" } }, getRpcInterfaces());
  RpcManager.registerImpl(ECSchemaRpcInterface, ECSchemaRpcImpl);

  // create a basic express web server
  const port = 5011;
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  console.log(`Web backend for schema-rpc-tests listening on port ${port}`); // eslint-disable-line
})();
