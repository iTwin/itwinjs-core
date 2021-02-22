/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { logBuildError, logBuildWarning, failBuild, throwAfterTimeout } = require("./utils");

const rushCommonDir = path.join(__dirname, "../../../../common/");

(async () => {
  const commonTempDir = path.join(rushCommonDir, "config/rush");

  // Npm audit will occasionally take minutes to respond - we believe this is just the npm registry being terrible and slow.
  // We don't want this to slow down our builds though - we'd rather fail fast and try again later.  So we'll just timeout after 30 seconds.
  let jsonOut = {};
  try {
    console.time("Audit time");
    jsonOut = await Promise.race([runPnpmAuditAsync(commonTempDir), throwAfterTimeout(180000, "Timed out contacting npm registry.")]);
    console.timeEnd("Audit time");
    console.log();
  } catch (error) {
    // We want to stop failing the build on transient failures and instead fail only on high/critical vulnerabilities.
    logBuildWarning(error);
    process.exit();
  }

  if (jsonOut.error) {
    console.error(jsonOut.error.summary);
    logBuildWarning("Rush audit failed. This may be caused by a problem with the npm audit server.");
  }

  for (const action of jsonOut.actions) {
    for (const issue of action.resolves) {
      const advisory = jsonOut.advisories[issue.id];

      // TODO: This path no longer resolves to a specific package in the repo.  Need to figure out the best way to handle it
      const mpath = issue.path; // .replace("@rush-temp", "@bentley");

      const severity = advisory.severity.toUpperCase();
      const message = `${severity} Security Vulnerability: ${advisory.title} in ${advisory.module_name} (from ${mpath}).  See ${advisory.url} for more info.`;


      // TODO: Temporarily lower the threshold of the immer security issue until we can consume a fix.  Id === 1603

      // For now, we'll only treat CRITICAL and HIGH vulnerabilities as errors in CI builds.
      if (advisory.id !== 1603 && (severity === "HIGH" || severity === "CRITICAL"))
        logBuildError(message);
      else if (advisory.id === 1603 || severity === "MODERATE") // Only warn on Moderate severity items
        logBuildWarning(message);
    }
  }

  // For some reason yarn audit can return the json without the vulnerabilities
  if (undefined === jsonOut.metadata.vulnerabilities)
    failBuild();

  if (jsonOut.metadata.vulnerabilities.high || jsonOut.metadata.vulnerabilities.critical) {
    if ((1 < jsonOut.actions.length || jsonOut.actions[0].resolves[0].id !== 725) && jsonOut.actions[3].resolves[0].id !== 1603) {
      console.log("log")
      failBuild();
    }
  }

  process.exit();
})();

function runPnpmAuditAsync(cwd) {
  return new Promise((resolve, reject) => {
    // pnpm audit requires a package.json file so we temporarily create one and
    // then delete it later
    fs.writeFileSync(path.join(rushCommonDir, "config/rush/package.json"), JSON.stringify("{}", null, 2));

    console.log("Running audit");
    const pnpmPath = path.join(rushCommonDir, "temp/pnpm-local/node_modules/.bin/pnpm");
    const child = spawn(pnpmPath, ["audit", "--json"], { cwd, shell: true });

    let stdout = "";
    let result = {
      actions: [{ resolves: [], },],
      advisories: {},
    };
    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.on('error', (data) => {
      fs.unlinkSync(path.join(rushCommonDir, "config/rush/package.json"));
      reject(data)
    });
    child.on('close', () => {
      fs.unlinkSync(path.join(rushCommonDir, "config/rush/package.json"));
      resolve(JSON.parse(stdout.trim()));
    });
  });
}
