/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/* WIP WIP WIP: Disabled because of switch to pnpm
const path = require("path");
const fs = require("fs");
const { spawnSync } = require("child_process");
const { requireFromTempNodeModules, logBuildError, logBuildWarning, failBuild } = require("./utils");

// NEEDSWORK: This really isn't the safest way to import the ssri package - I don't actually know how it gets into common/temp/node_modules,
// or if npm is going to move it somewhere else someday, but this seems a lot easier for now than having to setup an entire package just for this script.
const ssri = requireFromTempNodeModules("ssri");

// There seems to be an issue with the shrinkwrap file rush creates in common/temp.
// Basically, the shrinkwrap contains @rush-temp packages with undefined versions.
// We'll just fix these versions to use the file:/ versions that npm is expecting.
const shrinkwrapPath = path.join(__dirname, "..", "temp", "npm-shrinkwrap.json");
const shrinkwrap = require(shrinkwrapPath);
for (const k of Object.keys(shrinkwrap.dependencies)) {
  if (/^@rush-temp/.test(k)) {
    const dep = shrinkwrap.dependencies[k];
    if (!dep.version) {
      dep.version = `file:./projects/${k.replace("@rush-temp/", "")}.tgz`
    }
  }
}

// Note that we're NOT overwriting common/config/npm-shrinkwrap.json, just the copy in common/temp
fs.writeFileSync(shrinkwrapPath, JSON.stringify(shrinkwrap));

const results = spawnSync("npm", ["audit", "--json"], { cwd: path.join(__dirname, "..", "temp"), shell: true });
const jsonOut = JSON.parse(results.stdout.toString());

// For some stupid reason, npm ALWAYS scrubs local/unpublished package names from its audit report.
// So in order for our warnings/errors to make sense, we have to recompute these hashes and build out a mapping of hash => package name.
const hashes = {};
for (const k of Object.keys(shrinkwrap.dependencies)) {
  if (/^@(rush-temp|bentley)\//.test(k)) {
    const keyHash = ssri.fromData(jsonOut.runId + ' ' + k, { algorithms: ['sha256'] }).hexDigest();
    hashes[keyHash] = k.replace("@rush-temp/", "@bentley/");
  }
}

if (jsonOut.error) {
  console.error(jsonOut.error.summary);
  logBuildError("Rush audit failed. This may be caused by a problem with the npm-shrinkwrap.json.");
  failBuild();
}

for (const action of jsonOut.actions) {
  for (const issue of action.resolves) {
    const advisory = jsonOut.advisories[issue.id];

    // Map "scrubbed" packages hashes back to readable package names
    const mpath = issue.path.replace(/[\da-f]{64}/, (match) => hashes[match])

    const severity = advisory.severity.toUpperCase();
    const message = `${severity} Security Vulnerability: ${advisory.title} in ${advisory.module_name} (from ${mpath}).  See ${advisory.url} for more info.`;

    // WORKAROUND: The following security vulnerability is from webpack-dev-server versions <3.1.5.  This repository has been updated to 3.1.6, however due to a typo
    // in the npm vulnerability database, https://github.com/webpack/webpack-dev-server/issues/1615 and https://npm.community/t/npm-audit-sweems-to-get-semver-wrong/4352/4,
    // npm audit is still flagging this as an issue.
    //
    // Security Warning:
    //    ERROR: HIGH Security Vulnerability: Missing Origin Validation in webpack-dev-server (from webpack-dev-server).  See https://npmjs.com/advisories/725 for more info.
    if (725 === issue.id) {
      if (process.env.TF_BUILD && process.platform === "win32")
        console.log("##vso[task.logissue type=warning;]%s", message);
      else
        console.log("WARNING: %s", message);
      continue;
    }

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
*/
