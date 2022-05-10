/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

const FS = require('fs-extra');
const rootPackageJson = require('../../../../package.json');

// Appends the directory of the package root to the Typedoc JSON output
function addSourceDir(file, directory) {
  if (FS.existsSync(file) && FS.statSync(file).isFile()) {
    const contents = FS.readFileSync(file, 'utf-8');
    let packageRoot = directory.substring(directory.indexOf(rootPackageJson.name) + rootPackageJson.name.length + 1);
    let jsonContents = JSON.parse(contents);
    jsonContents['packageRoot'] = packageRoot.endsWith('src') ? packageRoot : `${packageRoot}\\${'src'}`;
    FS.writeFileSync(file, Buffer.from(JSON.stringify(jsonContents, null, 2)));
  }
}

module.exports = {
  addSourceDir
};
