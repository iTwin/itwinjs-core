/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
"use strict";

const path = require("path");
const fs = require("fs");
const url = require("url");

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

const envPublicUrl = process.env.PUBLIC_URL;
const electronUrlProtocol = (process.env.ELECTRON_ENV === "production") ? "electron://" : null;

function ensureSlash(path, needsSlash) {
  const hasSlash = path.endsWith("/");
  if (hasSlash && !needsSlash) {
    return path.substr(path, path.length - 1);
  } else if (!hasSlash && needsSlash) {
    return `${path}/`;
  } else {
    return path;
  }
}

const getPublicUrl = appPackageJson =>
  envPublicUrl || electronUrlProtocol || require(appPackageJson).homepage;

// We use `PUBLIC_URL` environment variable or "homepage" field to infer
// "public path" at which the app is served.
// Webpack needs to know it to put the right <script> hrefs into HTML even in
// single-page apps that may serve index.html for nested URLs like /todos/42.
// We can't use a relative path in HTML because we don't want to load something
// like /todos/42/static/js/bundle.7289d.js. We have to know the root.
function getServedPath(appPackageJson) {
  const publicUrl = getPublicUrl(appPackageJson);
  const servedUrl =
    envPublicUrl || (publicUrl ? publicUrl : "/");
  return ensureSlash(servedUrl, true);
}

// Allow projects to override certain paths by specifying buildConfig.paths in their package.json
function getPackageJsonPathOverrides(appPackageJson) {
  const buildConfig = require(appPackageJson).buildConfig || {};
  let pathOverrides = buildConfig.paths || {};
  for (const key of Object.keys(pathOverrides)) {
    pathOverrides[key] = resolveApp(pathOverrides[key])
  }

  return pathOverrides;
}

// We'll define all of these paths in several steps, so that each level of subdirectories is relative to the last.
// That way, you can just override appSrc without having to also redefine appSrcFrontend, appSrcBackend, etc.

// First we'll setup a "base" config, with any top-level paths.
// This will also contain *all* path overrides specified in the app's package.json
let baseConfig = {
  // Top-level files
  dotenv: resolveApp(".env"),
  appTsConfig: resolveApp("tsconfig.json"),
  appPackageJson: resolveApp("package.json"),
  appPackageLockJson: resolveApp("package-lock.json"),
  
  // Top-level directories
  appNodeModules: resolveApp("node_modules"),
  appSrc: resolveApp("src"),
  appTest: resolveApp("test"),
  appAssets: resolveApp("assets"),
  appPublic: resolveApp("public"),
  appLib: resolveApp("lib"),
  appCoverage: resolveApp("coverage"),
  appSnapshots: resolveApp(".snapshots"),
  appWebpackConfigs: appDirectory,

  // Misc. Config
  publicUrl: getPublicUrl(resolveApp("package.json")),
  servedPath: getServedPath(resolveApp("package.json")),

  ...getPackageJsonPathOverrides(resolveApp("package.json"))
}

// Now add any subdirectories that the final set of paths may depend on
baseConfig.appSrcFrontend = baseConfig.appSrcFrontend || path.resolve(baseConfig.appSrc, "frontend");
baseConfig.appSrcBackend = baseConfig.appSrcBackend || path.resolve(baseConfig.appSrc, "backend");
baseConfig.appTestE2E = baseConfig.appTestE2E || path.resolve(baseConfig.appTest, "e2e");

// Finally, include all deeply nested paths that are relative to an earlier path.
module.exports = {
  // lib/
  appLibPublic: path.resolve(baseConfig.appLib, "public"),
  appBuiltMainJs: path.resolve(baseConfig.appLib, "main.js"),
  appFrontendStats: path.resolve(baseConfig.appLib, "frontend.stats.json"),
  appBackendStats: path.resolve(baseConfig.appLib, "backend.stats.json"),
  appTestResults: baseConfig.appLib, // We may move this in a future release...
  
  // src/
  appSrcBackendWeb: path.resolve(baseConfig.appSrcBackend, "web"),
  appSrcBackendElectron: path.resolve(baseConfig.appSrcBackend, "electron"),
  appMainJs: path.resolve(baseConfig.appSrcBackend, "main.ts"),
  appIndexJs: path.resolve(baseConfig.appSrcFrontend, "index.tsx"),
  
  // test/e2e/
  appTestE2ELib: path.resolve(baseConfig.appTestE2E, "lib"),
  appTestE2EScreenshots: path.resolve(baseConfig.appTestE2E, "screenshots"),

  // public/
  appHtml: path.resolve(baseConfig.appPublic, "index.html"),

  // node_modules
  appBentleyNodeModules: path.resolve(baseConfig.appNodeModules, "@bentley"),

  // webpack/
  appWebpackConfigBase: path.resolve(baseConfig.appWebpackConfigs, "webpack.config.js"),
  appWebpackConfigBackend: path.resolve(baseConfig.appWebpackConfigs, "webpack.config.backend.js"),
  appWebpackConfigFrontend: path.resolve(baseConfig.appWebpackConfigs, "webpack.config.frontend.js"),
  appWebpackConfigTest: path.resolve(baseConfig.appWebpackConfigs, "webpack.config.test.js"),

  // Note that this will *still*overwrite any of the above paths 
  ...baseConfig,
};