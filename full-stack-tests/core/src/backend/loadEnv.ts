/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";

/** Loads the provided `.env` file into process.env, handling dotenv-expand v5 and v9+. */
export function loadEnv(envFile: string): void {
  if (!fs.existsSync(envFile))
    return;

  const dotenv = require("dotenv"); // eslint-disable-line @typescript-eslint/no-require-imports
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error)
    throw envResult.error;

  const dotenvExpand = require("dotenv-expand"); // eslint-disable-line @typescript-eslint/no-require-imports
  // Handle both v5 (function export) and v9+ ({ expand } export)
  const expandFn = typeof dotenvExpand === "function" ? dotenvExpand : dotenvExpand.expand;
  if (typeof expandFn === "function") expandFn(envResult);
}
