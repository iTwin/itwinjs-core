/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Bridge-only initialization: loads .env and registers backend callbacks.
// Used as `backendInitModule` for @itwin/vitest-certa-bridge plugin.
// Does NOT start the RPC server — that lives in BackendServer.ts.

import * as fs from "fs";
import * as path from "path";
import { exposeBackendCallbacks } from "../certa/certaBackend";

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

loadEnv(path.join(__dirname, "..", "..", ".env"));
exposeBackendCallbacks();
