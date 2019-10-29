/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const ssri = require("ssri");
const { spawn, spawnSync } = require("child_process");
const { logBuildError, logBuildWarning, failBuild, throwAfterTimeout } = require("./utils");

(async () => {
  const commonTempDir = path.join(__dirname, "../../../../common/temp");

  // Unfortunately, `pnpm` does not yet support audit, and `npm audit` requires a package-lock file.
  // So we have to use `npm` (***not*** `pnpm`) to create a package-lock _before_ we can run the audit.
  // Since npm only uses the package.json that rush has created (and not pnpm's shrinkwrap.yaml), it's very likely that
  // this lock file won't match some of the versions in our shrinkwrap, but it should at least match direct dependencies.
  console.time("Install time");
  spawnSync("npm", ["install", "--package-lock-only"], { cwd: commonTempDir, shell: true });
  console.timeEnd("Install time");

  // Npm audit will occasionally take minutes to respond - we believe this is just the npm registry being terrible and slow.
  // We don't want this to slow down our builds though - we'd rather fail fast and try again later.  So we'll just timeout after 30 seconds.
  let jsonOut = {};
  try {
    console.time("Audit time");
    jsonOut = await Promise.race([runNpmAuditAsync(commonTempDir), throwAfterTimeout(30000, "Timed out contacting npm registry.")]);
    console.timeEnd("Audit time");
    console.log();
  } catch (error) {
    logBuildError(error);
    failBuild();
  }

  // For some stupid reason, npm ALWAYS scrubs local/unpublished package names from its audit report (even when just logging to the console).
  // So in order for our warnings/errors to make sense, we have to recompute these hashes and build out a mapping of hash => package name.
  const hashes = {};
  const packageJson = require(path.join(commonTempDir, "package.json"));
  for (const k of Object.keys(packageJson.dependencies)) {
    if (/^@(rush-temp|bentley)\//.test(k)) {
      const keyHash = ssri.fromData(jsonOut.runId + ' ' + k, { algorithms: ['sha256'] }).hexDigest();
      hashes[keyHash] = k.replace("@rush-temp/", "@bentley/");
    }
  }

  if (jsonOut.error) {
    console.error(jsonOut.error.summary);
    logBuildError("Rush audit failed. This may be caused by a problem with npm.");
    failBuild();
  }

  for (const action of jsonOut.actions) {
    for (const issue of action.resolves) {
      const advisory = jsonOut.advisories[issue.id];

      // Map "scrubbed" packages hashes back to readable package names
      const mpath = issue.path.replace(/[\da-f]{64}/, (match) => hashes[match])

      const severity = advisory.severity.toUpperCase();
      const message = `${severity} Security Vulnerability: ${advisory.title} in ${advisory.module_name} (from ${mpath}).  See ${advisory.url} for more info.`;

      // For now, we'll only treat HIGH and CRITICAL vulnerabilities as errors in CI builds.
      if (severity === "HIGH" || severity === "CRITICAL")
        logBuildError(message);
      else
        logBuildWarning(message);
    }
  }

  if (jsonOut.metadata.vulnerabilities.high || jsonOut.metadata.vulnerabilities.critical) {
    if (1 < jsonOut.actions.length || jsonOut.actions[0].resolves[0].id !== 725)
      failBuild();
  }

  process.exit();
})();

function runNpmAuditAsync(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["audit", "--json"], { cwd, shell: true });

    let stdout = "";
    child.stdout.on('data', (data) => { stdout += data; });
    child.stderr.on('data', (data) => { process.stderr.write(data); });

    child.on('error', (data) => reject(data));
    child.on('close', () => resolve(JSON.parse(stdout.toString())));
  });
}