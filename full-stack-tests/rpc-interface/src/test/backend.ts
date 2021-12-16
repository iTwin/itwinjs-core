/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Sets up a local backend to be used for testing within the iTwin.js Core repo.

import * as path from "path";
import { IModelHubBackend } from "@bentley/imodelhub-client/lib/cjs/imodelhub-node";
import { IModelJsExpressServer } from "@itwin/express-server";
import { IModelHost, IModelHostConfiguration } from "@itwin/core-backend";
import { BentleyCloudRpcManager, RpcConfiguration } from "@itwin/core-common";
import { Presentation as PresentationBackend } from "@itwin/presentation-backend";
import { getRpcInterfaces, Settings } from "../common/Settings";
import * as fs from "fs";

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
const settings = new Settings(process.env);

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  RpcConfiguration.developmentMode = true;

  // Start the backend
  const hostConfig = new IModelHostConfiguration();
  hostConfig.hubAccess = new IModelHubBackend();
  await IModelHost.startup(hostConfig);

  PresentationBackend.initialize();

  const rpcConfig = BentleyCloudRpcManager.initializeImpl({ info: { title: "full-stack-test", version: "v1.0" } }, getRpcInterfaces(settings));

  // create a basic express web server
  const port = 5011;
  const server = new IModelJsExpressServer(rpcConfig.protocol);
  await server.initialize(port);
  // eslint-disable-next-line no-console
  console.log(`Web backend for full-stack-tests listening on port ${port}`);
})();
