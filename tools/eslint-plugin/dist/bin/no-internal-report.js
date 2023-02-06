#! /usr/bin/env node

/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict"

const formatterPath = require.resolve("../formatters/no-internal-summary.js");

// Run eslint with the appropriate configuration and formatter to get a report of the no-internal rule
let args = [
  "--no-eslintrc",
  "-f", formatterPath,
  "--plugin", "@itwin",
  "--rule", "@itwin/no-internal:'error'",
  "--parser", "@typescript-eslint/parser",
  "--parser-options", "{project:'tsconfig.json',sourceType:'module'}",
  ...process.argv.slice(2)
];

let results;
try {
  const { execFileSync } = require('child_process');
  results = execFileSync("eslint", args);
} catch (error) {
  results = error.stdout;
}
console.log(results.toString());
