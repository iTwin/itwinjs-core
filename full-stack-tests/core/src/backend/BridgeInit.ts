/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Bridge-only initialization: loads .env and registers backend callbacks.
// Used as `backendInitModule` for @itwin/vitest-certa-bridge plugin.
// Does NOT start the RPC server — that lives in BackendServer.ts.

import * as path from "path";
import { exposeBackendCallbacks } from "../certa/certaBackend";
import { loadEnv } from "./loadEnv";

loadEnv(path.join(__dirname, "..", "..", ".env"));
exposeBackendCallbacks();
