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

// Resolves the root of the Rush repo
const resolveRoot = relativePath => {
  // recurse until you find the "rush.json"
  const parts = appDirectory.split(path.sep).reverse();
  while (parts.length > 0) {
    const resolved = path.join(parts.slice().reverse().join(path.sep), "rush.json");
    if (fs.existsSync(resolved))
      return path.join(parts.slice().reverse().join(path.sep), relativePath);
    parts.shift();
  }
  process.stderr.write("Root of the Rush repository not found.  Missing a rush.json file?");
  process.exit(1);
}

module.exports = {
  appSrc: resolveApp('src'),
  appTest: resolveApp('src/test'),
  appLib: resolveApp('lib'),
  appLibPublic: resolveApp('lib/public'),
  appLibTests: resolveApp('lib/test'),
  appPublic: resolveApp('public'),
  appDocs: resolveApp('lib/docs'),
  appJsonDocs: resolveApp('lib/docs/json/file.json'),
  appJUnitTestResults: resolveApp('lib/test/junit_results.xml'),
  libExtract: resolveApp('lib/extract'),
  appLocalesEnglish: resolveApp('public/locales/en'),
  appLocalesPseudolocalize: resolveApp('public/locales/en-pseudo'),
  rushCommon: resolveRoot('common'),
};
