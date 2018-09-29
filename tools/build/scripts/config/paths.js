/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 - present Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
'use strict';

const path = require('path');
const fs = require('fs-extra');
const url = require('url');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

module.exports = {
  appRoot: resolveApp(''),
  appSrc: resolveApp('source'),
  appTest: resolveApp('source/test'),
  appBuild: resolveApp('lib'),
  dotenv: resolveApp('.env'),
  appLib: resolveApp('lib'),
  appLibPublic: resolveApp('lib/public'),
  appDist: resolveApp('dist'),
  appPublic: resolveApp('public'),
  appLibTests: resolveApp('lib/test'),
  appDocs: resolveApp('lib/docs'),
  appJsonDocs: resolveApp('lib/docs/json/file.json'),
  appJUnitTestResults: resolveApp('lib/test/junit_results.xml'),
  appAssets: resolveApp('source/assets'),
  appTestAssets: resolveApp('source/test/assets'),
  libExtract: resolveApp('lib/extract'),
  appLocalesEnglish: resolveApp ('public/locales/en'),
  appLocalesPseudolocalize: resolveApp ('public/locales/en-pseudo'),
  appHtml: resolveApp('public/index.html'),
  appIndexJs: resolveApp('source/frontend/index.tsx'),
  appPackageJson: resolveApp('package.json'),
  appPackageLockJson: resolveApp('package-lock.json'),
  appNodeModules: resolveApp('node_modules'),
  appTsConfig: resolveApp('tsconfig.json'),
  appSrcBackend: resolveApp('source/backend'),
  appSrcFrontend: resolveApp('source/frontend'),
};
