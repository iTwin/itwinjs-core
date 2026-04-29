/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @internal */
export function loadEnvFile(envFile: string): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("fs");
  if (!fs.existsSync(envFile)) return;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenv = require("dotenv");
  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) throw envResult.error;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenvExpand = require("dotenv-expand");
  // Handle both v5 (function export) and v9+ ({ expand } export)
  const expandFn = typeof dotenvExpand === "function" ? dotenvExpand : dotenvExpand.expand;
  if (typeof expandFn === "function") expandFn(envResult);
}
