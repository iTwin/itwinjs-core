/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// This script examines the output of the statistics that webpack puts out to find what modules each of our packages use,
// their sizes, and to what extent they overlap. Then we can decide what to webpack and what to externalize.
const path = require("path");
const fs = require("fs-extra")

// information that we keep for each package as we encounter its stats file.
class PackageInfo {
  constructor(packageName) {
    this.packageName = packageName;
    // make a map of moduleName -> moduleInfos
    this.moduleMap = new Map();
  }

  // add a module used for this package.
  addModule(moduleName) {
    let moduleInfo = this.moduleMap.get(moduleName);
    if (!moduleInfo) {
      moduleInfo = new ModuleInfo(moduleName);
      this.moduleMap.set(moduleName, moduleInfo);
    }
    return moduleInfo;
  }
}

// information that we keep for each non-bentley top-level package used in a the package.
class ModuleInfo {
  constructor(moduleName) {
    this.moduleName = moduleName;
    this.contentMap = new Map();
  }

  // add an entry for the map for this sub-module (a .js file in a module)
  addContent(contentName, size) {
    let contentInfo = this.contentMap.get(contentName);
    if (!contentInfo) {
      contentInfo = new ContentInfo(contentName, size);
      this.contentMap.set(contentName, contentInfo);
    }
    return contentInfo
  }
}

// information we keep for each module within a top-level package
class ContentInfo {
  constructor(contentName, size) {
    this.contentName = contentName;
    this.size = size;
  }
}

// get the module name and the subcontent name from its "id".
function moduleNameFromId(moduleId) {
  if (typeof moduleId !== "string")
    return undefined;

  const nmLoc = moduleId.indexOf("node_modules");
  if (-1 == nmLoc)
    return undefined;
  const endName = moduleId.indexOf("/", nmLoc + 13);
  if (-1 == endName)
    return undefined;

  const moduleReturn = {};
  moduleReturn.name = moduleId.substring(nmLoc + 13, endName);
  const subName = moduleId.lastIndexOf("/");
  if (subName != -1)
    moduleReturn.subContent = moduleId.substring(subName + 1);
  else
    moduleReturn.subContent = moduleReturn.name
  return moduleReturn;
}

// entry in the consolidated modules subcontent map.
class UniqueContentCount {
  constructor(subContent, packageUsing) {
    this.contentName = subContent.contentName;
    this.size = subContent.size;
    this.packageList = [];
    this.packageList[0] = packageUsing
  }
}

// Entry in the consolidated modules map
class UniqueModule {
  constructor(moduleName, packageUsing, contentMap) {
    this.moduleName = moduleName;
    this.packageList = [];
    this.packageList[0] = packageUsing;
    this.uniqueContentMap = new Map();
    contentMap.forEach((value, key) => { this.uniqueContentMap.set(key, new UniqueContentCount(value)) }, this);
  }

  consolidateWith(thisUniqueModule, packageUsing) {
    this.packageList[this.packageList.length] = packageUsing;
    thisUniqueModule.contentMap.forEach((value, key) => {
      const uniqueContentCount = this.uniqueContentMap.get(key);
      if (uniqueContentCount)
        uniqueContentCount.packageList[uniqueContentCount.packageList.length] = packageUsing;
      else
        this.uniqueContentMap.set(key, new UniqueContentCount(value, packageUsing));
    }, this)
  }
}

// process each of our modules.
function main() {
  // this might need to be changed if this script is moved.
  const rootDir = path.resolve("../../../");

  const pathToJsonFile = "lib/module/dev/webpackStats0.json";

  const directories = ["core/bentley", "core/geometry", "core/common", "core/clients", "core/i18n", "core/quantity", "core/frontend", "ui/core",
    "ui/components", "ui/ninezone", "ui/framework", "presentation/common", "presentation/components", "presentation/frontend"]

  // create the directory of packageInfos.
  const packageInfos = [];

  let iPackage = 0;
  for (const directory of directories) {
    packageInfos[iPackage] = new PackageInfo(directory);
    const fileName = path.resolve(rootDir, directory, pathToJsonFile);

    if (!fs.existsSync(fileName)) {
      console.log("File ", fileName, "does not exist, skipping");
      continue;
    }

    try {
      // open and read the webpack stats json file.
      const fileContents = fs.readFileSync(fileName, "utf8");

      // parse it
      const wpStats = JSON.parse(fileContents);

      console.log("Processing Modules in package", directory);
      for (module of wpStats.modules) {
        const moduleReturn = moduleNameFromId(module.id);
        if (moduleReturn) {
          const moduleInfo = packageInfos[iPackage].addModule(moduleReturn.name);
          moduleInfo.addContent(moduleReturn.subContent, module.size);
        }
      }
    } catch (e) {
      console.log("Error", e, "reading ", fileName);
    }
    iPackage++;
  }

  // we now have packageInfos for all of our packages. Now we process each of them to figure out which are used in more than one

  // create a map of all the modules from all the packages, consolidating their usage.
  const allModules = new Map();
  for (const thisPackage of packageInfos) {
    console.log("\n Modules used in Package", thisPackage.packageName);
    for (const thisModule of thisPackage.moduleMap.values()) {
      const foundModule = allModules.get(thisModule.moduleName);
      if (foundModule) {
        foundModule.consolidateWith(thisModule, thisPackage);
      } else {
        allModules.set(thisModule.moduleName, new UniqueModule(thisModule.moduleName, thisPackage, thisModule.contentMap));
      }
      console.log("   Module name", thisModule.moduleName);
      for (const thisSubContent of thisModule.contentMap.values()) {
        console.log("        SubContent", thisSubContent.contentName, " size", thisSubContent.size);
      }
    }
  }

  const sharedModules = new Map();
  // first, take a pass through allModules and show those that are used by only one package.
  console.log("\n\nModules use by only one package");
  for (const thisModule of allModules.values()) {
    if (thisModule.packageList.length === 1) {
      let totalSize = 0;
      for (const subContent of thisModule.uniqueContentMap.values()) {
        totalSize += subContent.size;
      }
      console.log("  Module:", thisModule.moduleName, "used by", thisModule.packageList[0].packageName, "with total size of", totalSize);
    } else {
      sharedModules.set(thisModule.moduleName, thisModule);
    }
  }

  // now show all the shared modules.
  console.log("\nModules shared by more than one package");
  for (const thisModule of sharedModules.values()) {
    console.log("  Module", thisModule.moduleName, "is used by:");

    // show packages that use this module.
    for (const thisPackage of thisModule.packageList) {
      console.log("   ", thisPackage.packageName);
    }

    // show the sizes of categories of subcontents of the module.
    let totalSharedByAllSize = 0;
    let totalSharedByMultiple = 0;
    let totalNonSharedSize = 0;
    for (const thisUniqueContent of thisModule.uniqueContentMap.values()) {
      if (thisUniqueContent.packageList.length === thisModule.packageList.length) {
        totalSharedByAllSize += thisUniqueContent.size;
      } else if (thisUniqueContent.packageList.length > 1) {
        totalSharedByMultiple += thisUniqueContent.size;
      } else {
        totalNonSharedSize += thisUniqueContent.size;
      }
    }
    console.log("    size used by all:", totalSharedByAllSize, "size used by multiple:", totalSharedByMultiple, "size used by only one:", totalNonSharedSize);
  }
}




main();