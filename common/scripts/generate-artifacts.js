/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
"use strict";

const { execFileSync } = require("node:child_process");
const { existsSync, readFileSync } = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");
const rushConfig = JSON.parse(readFileSync(path.join(repoRoot, "rush.json"), "utf8"));

function readPackageJson(packageRoot) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  if (!existsSync(packageJsonPath))
    return undefined;

  return JSON.parse(readFileSync(packageJsonPath, "utf8"));
}

function extractApiAlreadyRunsGenerate(packageJson) {
  const extractApiScript = packageJson?.scripts?.["extract-api"];
  if (typeof extractApiScript !== "string")
    return false;

  return /^npm run -s generate$/.test(extractApiScript.trim());
}

const generators = rushConfig.projects
  .map((project) => ({
    packageName: project.packageName,
    packageRoot: path.join(repoRoot, project.projectFolder),
  }))
  .map((project) => ({
    ...project,
    packageJson: readPackageJson(project.packageRoot),
  }))
  .filter((project) => typeof project.packageJson?.scripts?.generate === "string")
  .filter((project) => !extractApiAlreadyRunsGenerate(project.packageJson));

if (generators.length === 0) {
  console.log("No package generate scripts found.");
  process.exit(0);
}

for (const generator of generators) {
  console.log(`==> ${generator.packageName}`);
  execFileSync("npm", ["run", "-s", "generate"], {
    cwd: generator.packageRoot,
    stdio: "inherit",
  });
}
