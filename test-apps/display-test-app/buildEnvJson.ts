/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";

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

function main() {
  // Load the contents of ./.env into process.env.
  loadEnv(path.join(__dirname, ".env"));
  // Load the contents of ./.env.local into process.env.
  loadEnv(path.join(__dirname, ".env.local"));
  const imjsEnv: { [name: string]: string | undefined } = {};
  // Extract all environment variables with an IMJS_ prefix into imjsEnv.
  Object.keys(process.env).forEach((key) => {
    if (key.startsWith("IMJS_")) {
      imjsEnv[key] = process.env[key];
    }
  });
  const jsonPath = path.join(__dirname, "lib", "ios", "env.json");
  // Write the contents of imjsEnv to ./lib/ios/env.json
  fs.writeFileSync(jsonPath, JSON.stringify(imjsEnv, undefined, 2));
  console.log(`Wrote environment to ${jsonPath}`);
}

main();
