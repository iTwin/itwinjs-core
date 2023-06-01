/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/* eslint-disable no-console */
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import dotenvExpand from "dotenv-expand";

/** Loads the provided `.env` file into import.meta.env */
function loadEnv(envFile: string) {
  if (!fs.existsSync(envFile))
    return;

  const envResult = dotenv.config({ path: envFile });
  if (envResult.error) {
    throw envResult.error;
  }

  dotenvExpand(envResult);
}

function main() {
  // Note: loadEnv does not overwrite existing settings, so load most specific file first, and least specific last.
  // Load the contents of ./.env.local.mobile into import.meta.env.
  loadEnv(path.join(__dirname, ".env.local.mobile"));
  // Load the contents of ./.env.local into import.meta.env.
  loadEnv(path.join(__dirname, ".env.local"));
  // Load the contents of ./.env into import.meta.env.
  loadEnv(path.join(__dirname, ".env"));
  const imjsEnv: { [name: string]: string | undefined } = {};
  // Extract all environment variables with an IMJS_ prefix into imjsEnv.
  Object.keys(import.meta.env).forEach((key) => {
    if (key.startsWith("IMJS_")) {
      imjsEnv[key] = import.meta.env[key];
    }
  });
  const jsonPath = path.join(__dirname, "lib", "mobile", "env.json");
  // Write the contents of imjsEnv to ./lib/mobile/env.json
  fs.writeFileSync(jsonPath, JSON.stringify(imjsEnv, undefined, 2));
  console.log(`Wrote environment to ${jsonPath}`);
}

main();
