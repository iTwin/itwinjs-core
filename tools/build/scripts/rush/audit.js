/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const { spawn } = require("child_process");
const { logBuildError, logBuildWarning, failBuild, throwAfterTimeout } = require("./utils");

(async () => {
  const commonTempDir = path.join(__dirname, "../../../../common/temp");

  // Npm audit will occasionally take minutes to respond - we believe this is just the npm registry being terrible and slow.
  // We don't want this to slow down our builds though - we'd rather fail fast and try again later.  So we'll just timeout after 30 seconds.
  let jsonOut = {};
  try {
    console.time("Audit time");
    jsonOut = await Promise.race([runYarnAuditAsync(commonTempDir), throwAfterTimeout(180000, "Timed out contacting npm registry.")]);
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

      const mpath = issue.path.replace("@rush-temp", "@bentley");

      const severity = advisory.severity.toUpperCase();
      const message = `${severity} Security Vulnerability: ${advisory.title} in ${advisory.module_name} (from ${mpath}).  See ${advisory.url} for more info.`;

      // For now, we'll only treat HIGH and CRITICAL vulnerabilities as errors in CI builds.
      if (severity === "HIGH" || severity === "CRITICAL")
        logBuildError(message);
      else
        logBuildWarning(message);
    }
  }

  // For some reason yarn audit can return the json without the vulnerabilities
  if (undefined === jsonOut.metadata.vulnerabilities)
    failBuild();

  if (jsonOut.metadata.vulnerabilities.high || jsonOut.metadata.vulnerabilities.critical) {
    if (1 < jsonOut.actions.length || jsonOut.actions[0].resolves[0].id !== 725)
      failBuild();
  }

  process.exit();
})();

function runYarnAuditAsync(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("yarn", ["audit", "--json"], { cwd, shell: true });

    let stdout = "";
    let result = {
      actions: [{ resolves: [], },],
      advisories: {},
    };
    child.stdout.on('data', (data) => {
      stdout += data;
    });

    child.on('error', (data) => reject(data));
    child.on('close', () => {
      const objs = JSON.parse("[" + stdout.trim().split("\n").join(",") + "]");
      for (obj of objs) {
        if (obj.type && obj.type === "auditAdvisory") {
          result.actions[0].resolves.push(obj.data.resolution);
          result.advisories[obj.data.resolution.id] = obj.data.advisory;
        }
        else if (obj.type && obj.type === "auditSummary")
          result.metadata = obj.data;
        resolve(result)
      }
    });
  });
}