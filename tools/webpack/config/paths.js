/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

const path = require('path');
const fs = require('fs');
const url = require('url');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

const envPublicUrl = process.env.PUBLIC_URL;
const electronUrlProtocol = (process.env.ELECTRON_ENV === "production") ? "electron://" : null;

function ensureSlash(path, needsSlash) {
  const hasSlash = path.endsWith('/');
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
    envPublicUrl || (publicUrl ? publicUrl : '/');
  return ensureSlash(servedUrl, true);
}

// config after eject: we're in ./config/
module.exports = {
  dotenv: resolveApp('.env'),
  appLib: resolveApp('lib'),
  appLibPublic: resolveApp('lib/public'),
  appPublic: resolveApp('public'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveApp('src/frontend/index.tsx'),
  appPackageJson: resolveApp('package.json'),
  appSrc: resolveApp('src'),
  appSrcBackend: resolveApp('src/backend'),
  appSrcBackendElectron: resolveApp('src/backend/electron'),
  appSrcBackendWeb: resolveApp('src/backend/web'),
  appSrcFrontend: resolveApp('src/frontend'),
  appTest: resolveApp('test'),
  appSnapshots: resolveApp('.snapshots.js'),
  yarnLockFile: resolveApp('yarn.lock'),        // STILL USED?
  testsSetup: resolveApp('src/setupTests.ts'),
  appNodeModules: resolveApp('node_modules'),
  appBackendNodeModules: resolveApp('src/backend/node_modules'),
  appFrontendNodeModules: resolveApp('src/frontend/node_modules'),
  appTsConfig: resolveApp('tsconfig.json'),
  publicUrl: getPublicUrl(resolveApp('package.json')),
  servedPath: getServedPath(resolveApp('package.json')),
  appMainJs: resolveApp('src/backend/main.ts'),
  appBuiltMainJs: resolveApp('lib/main.js'),
  appJUnitTestResults: resolveApp('lib/junit_results.xml'),
  imodeljsCommonRegex: /^\$\(iModelJs-Common\)/,
};