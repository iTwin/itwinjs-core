/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
'use strict';

const path = require('path');
const fs = require('fs-extra');

// Make sure any symlinks in the project folder are resolved:
// https://github.com/facebookincubator/create-react-app/issues/637
const appDirectory = fs.realpathSync(process.cwd());
const resolveApp = relativePath => path.resolve(appDirectory, relativePath);

module.exports = {
  appRoot: resolveApp(''),
  appSrc: resolveApp('source'),
  appTest: resolveApp('test'),
  appJUnitTestResults: resolveApp('lib/test/junit_results.xml'),
};