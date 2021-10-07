/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
'use strict';

const path = require('path');
const fs = require('fs-extra');

// Make sure any symlinks in the project folder are resolved:
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

module.exports = {
  appSrc: resolveApp('src'),
  appTest: resolveApp('src/test'),
  appLib: resolveApp('lib'),
  appLibPublic: resolveApp('lib/cjs/public'),
  appLibTests: resolveApp('lib/cjs/test'),
  appPublic: resolveApp('public'),
  appDocs: resolveApp('lib/cjs/docs'),
  appJsonDocs: resolveApp('lib/cjs/docs/json/file.json'),
  appJUnitTestResults: resolveApp('lib/test/junit_results.xml'),
  libExtract: resolveApp('lib/cjs/extract'),
  appLocalesEnglish: resolveApp('public/locales/en'),
  appLocalesPseudolocalize: resolveApp('public/locales/en-pseudo'),
};
