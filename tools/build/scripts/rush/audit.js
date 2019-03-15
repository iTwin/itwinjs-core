/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

const path = require("path");
const ssri = require("ssri");
const { spawnSync } = require("child_process");
const { logBuildError, logBuildWarning, failBuild } = require("./utils");

const commonTempDir = path.join(__dirname, "../../../../common/temp");

// Unfortunately, `pnpm` does not yet support audit, and `npm audit` requires a package-lock file.
// So we have to use `npm` (***not*** `pnpm`) to create a package-lock _before_ we can run the audit.
// Since npm only uses the package.json that rush has created (and not pnpm's shrinkwrap.yaml), it's very likely that
// this lock file won't match some of the versions in our shrinkwrap, but it should at least match direct dependencies.
spawnSync("npm", ["install", "--package-lock-only"], { cwd: commonTempDir, shell: true });

const results = spawnSync("npm", ["audit", "--json"], { cwd: commonTempDir, shell: true });
const jsonOut = JSON.parse(results.stdout.toString());

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
