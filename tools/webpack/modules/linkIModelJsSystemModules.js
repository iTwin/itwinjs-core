/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// This script can be used from package.json in an application external to the iModel.js
// monorepository to symlink the iModelJs system modules to its lib/webresources directory.
// It is an approximation (at best) of the application being in the monorepo. It always links
// the system modules from the development build (so your app must be built with the development
// build). The version of everything except the .js and .js.map files in the lib/webresource is
// not moved over. In particular, the node_modules @bentley contents are unchanged, so the
// .d.ts files, etc., will not match the modules you are running. USE AT YOUR OWN RISK.
// You must have administrator priviliges to make symlinks, so run as administrator.

const fs = require("fs-extra")
const path = require("path");

// checks contents of existing symlink and replaces it if necessary
function ensureSymlink(sourceFile, outFilePath) {
  try {
    if (fs.existsSync(outFilePath)) {
      try {
        const linkContents = fs.readlinkSync(outFilePath, { encoding: "utf8" });
        if (linkContents === sourceFile) {
          console.log("  File", outFilePath, "already exists");
          return 0;
        }
      } catch (_error) {
        console.log("   Deleting existing file:", outFilePath);
        // It's not a link, do nothing and let it get deleted.
      }
      console.log("  Removing existing symlink found in", outFilePath);
      fs.unlinkSync(outFilePath);
    }
    console.log("  Symlinking", sourceFile, "to", outFilePath);
    fs.symlinkSync(sourceFile, outFilePath);
  } catch (error) {
    console.log(error);
    return 1;
  }
  return 0; // success
}

function readPackageFileContents () {
  const packageFileName = path.resolve("./package.json");
  if (!fs.existsSync(packageFileName))
      return {};
  const packageFileContents = fs.readFileSync(packageFileName, "utf8");
  return JSON.parse(packageFileContents);
}

// description of each node_module.
class ModuleInfo {
  constructor(path, fileName) {
    this.relativePath = path;
    this.fileName = fileName;
  }
}

let modulesList = [
  new ModuleInfo("core/bentley/lib/module/dev", "bentleyjs-core.js"),
  new ModuleInfo("core/geometry/lib/module/dev", "geometry-core.js"),
  new ModuleInfo("core/i18n/lib/module/dev", "imodeljs-i18n.js"),
  new ModuleInfo("core/clients/lib/module/dev", "imodeljs-clients.js"),
  new ModuleInfo("core/common/lib/module/dev", "imodeljs-common.js"),
  new ModuleInfo("core/quantity/lib/module/dev", "imodeljs-quantity.js"),
  new ModuleInfo("core/frontend/lib/module/dev", "imodeljs-frontend.js"),
  new ModuleInfo("core/markup/lib/module/dev", "imodeljs-markup.js"),
  new ModuleInfo("ui/core/lib/module/dev", "ui-core.js"),
  new ModuleInfo("ui/components/lib/module/dev", "ui-components.js"),
  new ModuleInfo("ui/framework/lib/module/dev", "ui-framework.js"),
  new ModuleInfo("ui/ninezone/lib/module/dev", "ui-ninezone.js"),
  new ModuleInfo("presentation/common/lib/module/dev", "presentation-common.js"),
  new ModuleInfo("presentation/components/lib/module/dev", "presentation-components.js"),
  new ModuleInfo("presentation/frontend/lib/module/dev", "presentation-frontend.js"),
];

function getPackageName (fileName) {
  let packageRoot = fileName.slice(0, fileName.length-3);
  let packageName = "@bentley/".concat(packageRoot);
  return packageName;
}

function main() {
  let iModelJsDir = process.env.IMODELJS_SOURCE;
  if (!iModelJsDir) {
    console.log("You must set IMODELJS_SOURCE to the root directory of the iModelJs rush repository.");
    process.exit(1);
  }

  if (!fs.existsSync(iModelJsDir)) {
    console.log("IMODELJS_SOURCE is set to", iModelJsDir, "but that directory does not exist.");
    process.exit(1);
  }

  // The destination directory is our lib/webresources
  const destDir = path.resolve("./lib/webresources");
  if (!fs.existsSync(destDir)) {
    console.log("There is no ./lib/webresources directory to link to");
    process.exit(1);
  }

  let packageFileContents = readPackageFileContents();

  for (moduleInfo of modulesList) {
    let sourceFile = path.resolve(iModelJsDir, moduleInfo.relativePath, moduleInfo.fileName);
    let version = packageFileContents.dependencies[getPackageName(moduleInfo.fileName)];
    if (!version) {
      version = packageFileContents.dependencies[getPackageName("imodeljs-frontend.js")];
    }
    let outFilePath = path.resolve(destDir, "v".concat(version), moduleInfo.fileName);
    ensureSymlink(sourceFile, outFilePath);
    // now do the map file.
    outFilePath = outFilePath + ".map";
    sourceFile = sourceFile + ".map";
    ensureSymlink(sourceFile, outFilePath);
  }
}

main();
