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
    "GHSA-ww39-953v-wcq6", // https://github.com/advisories/GHSA-ww39-953v-wcq6 @bentley/react-scripts>@pmmmwh/react-refresh-webpack-plugin>webpack-dev-server>chokidar>glob-parent, webpack>watchpack>(optional)watchpack-chokidar2>chokidar>glob-parent
    "GHSA-33f9-j839-rf8h", // https://github.com/advisories/GHSA-33f9-j839-rf8h @bentley/extension-webpack-tools>react-dev-utils>immer, @bentley/react-scripts>react-dev-utils>immer
    "GHSA-c36v-fmgq-m8hx", // https://github.com/advisories/GHSA-c36v-fmgq-m8hx @bentley/extension-webpack-tools>react-dev-utils>immer, @bentley/react-scripts>react-dev-utils>immer
    "GHSA-whgm-jr23-g3j9", // https://github.com/advisories/GHSA-whgm-jr23-g3j9 @bentley/react-scripts>@pmmmwh/react-refresh-webpack-plugin>ansi-html, @bentley/react-scripts>webpack-dev-server>ansi-html
    "GHSA-x4jg-mjrx-434g", // https://github.com/advisories/GHSA-x4jg-mjrx-434g @bentley/react-scripts>webpack-dev-server>selfsigned>node-forge
    "GHSA-cfm4-qjh2-4765", // https://github.com/advisories/GHSA-cfm4-qjh2-4765 @bentley/react-scripts>webpack-dev-server>selfsigned>node-forge
    "GHSA-fwr7-v2mv-hh25", // https://github.com/advisories/GHSA-fwr7-v2mv-hh25 @bentley/react-scripts>fast-sass-loader>async, @bentley/react-scripts>webpack-dev-server>portfinder>async
    "GHSA-phwq-j96m-2c2q", // https://github.com/advisories/GHSA-phwq-j96m-2c2q @bentley/react-scripts>workbox-webpack-plugin>workbox-build>@surma/rollup-plugin-off-main-thread>ejs
    "GHSA-6h5x-7c5m-7cr7", // https://github.com/advisories/GHSA-6h5x-7c5m-7cr7 @bentley/react-scripts>webpack-dev-server>sockjs-client>eventsource
    "GHSA-rp65-9cf3-cjxr", // https://github.com/advisories/GHSA-rp65-9cf3-cjxr @bentley/react-scripts>@svgr/webpack>@svgr/plugin-svgo>svgo>css-select>nth-check
    "GHSA-g4rg-993r-mgx7", // https://github.com/advisories/GHSA-g4rg-993r-mgx7 @bentley/react-scripts>react-dev-utils>shell-quote
    "GHSA-4wf5-vphf-c2xc", // https://github.com/advisories/GHSA-4wf5-vphf-c2xc @bentley/react-scripts>terser-webpack-plugin>terser
    "GHSA-f8q6-p94x-37v3", // https://github.com/advisories/GHSA-f8q6-p94x-37v3 react-dev-utils>recursive-readdir>minimatch
    "GHSA-76p3-8jx3-jpfq", // https://github.com/advisories/GHSA-76p3-8jx3-jpfq @bentley/react-scripts>loader-utils
    "GHSA-3rfm-jhwj-7488", // https://github.com/advisories/GHSA-3rfm-jhwj-7488 @bentley/react-scripts>react-dev-utils>loader-utils
    "GHSA-hhq3-ff78-jv3g", // https://github.com/advisories/GHSA-hhq3-ff78-jv3g @bentley/react-scripts>react-dev-utils>loader-utils
    "GHSA-27h2-hvpr-p74q", // https://github.com/advisories/GHSA-27h2-hvpr-p74q @bentley/core-backend>azurite>jsonwebtoken
    "GHSA-9c47-m6qq-7p4h", // https://github.com/advisories/GHSA-9c47-m6qq-7p4h @bentley/backend-application-insights-client>webpack>loader-utils>json5, @bentley/geonames-extension>svg-sprite-loader>html-webpack-plugin>loader-utils>json5, @bentley/ecschema-editing>i18next-node-fs-backend>json5
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
