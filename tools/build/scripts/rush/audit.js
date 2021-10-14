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

  // A list of temporary advisories excluded from the High and Critical list.
  // Warning this should only be used as a temporary measure to avoid build failures
  // for development dependencies only.
  // All security issues should be addressed asap.
  const excludedAdvisories = [
    "GHSA-8p5q-j9m2-g8wr", // https://github.com/advisories/GHSA-8p5q-j9m2-g8wr.
    "GHSA-ww39-953v-wcq6", // https://github.com/advisories/GHSA-ww39-953v-wcq6.
    "GHSA-8v27-2fg9-7h62", // https://github.com/advisories/GHSA-8v27-2fg9-7h62.
    "GHSA-33f9-j839-rf8h", // https://github.com/advisories/GHSA-33f9-j839-rf8h.
    "GHSA-c36v-fmgq-m8hx", // https://github.com/advisories/GHSA-c36v-fmgq-m8hx.
    "GHSA-4jqc-8m5r-9rpr", // https://github.com/advisories/GHSA-4jqc-8m5r-9rpr.
    "GHSA-whgm-jr23-g3j9", // https://github.com/advisories/GHSA-whgm-jr23-g3j9.
  ];

  let shouldFailBuild = false;
  for (const action of jsonOut.actions) {
    for (const issue of action.resolves) {
      const advisory = jsonOut.advisories[issue.id];

      // TODO: This path no longer resolves to a specific package in the repo.  Need to figure out the best way to handle it
      const mpath = issue.path; // .replace("@rush-temp", "@bentley");

      const severity = advisory.severity.toUpperCase();
      const message = `${severity} Security Vulnerability: ${advisory.title} in ${advisory.module_name} (from ${mpath}).  See ${advisory.url} for more info.`;

      // For now, we'll only treat CRITICAL and HIGH vulnerabilities as errors in CI builds.
      if (!excludedAdvisories.includes(advisory.github_advisory_id) && (severity === "HIGH" || severity === "CRITICAL")) {
        logBuildError(message);
        shouldFailBuild = true;
      } else if (excludedAdvisories.includes(advisory.github_advisory_id) || severity === "MODERATE") // Only warn on MODERATE severity items
        logBuildWarning(message);
    }
  }

  // For some reason yarn audit can return the json without the vulnerabilities
  if (undefined === jsonOut.metadata.vulnerabilities || shouldFailBuild)
    failBuild();

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
