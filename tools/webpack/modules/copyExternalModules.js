/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

// This script copies the imodeljs modules (and specific others, such as React) that this module depends on
// to the specified directory.
const path = require("path");
const fs = require("fs-extra")
const argv = require("yargs").argv;
//                   --destDir={destination directory}
//                   -- type={dev|prod}

function makeModuleRelativePath(moduleName, relativePath) {
  return path.join(moduleName, relativePath);
}

function makeBentleyModulePath(nodeModulesPath, moduleName, isDev) {
  return path.resolve(nodeModulesPath, "node_modules", moduleName, isDev ? "lib/module/dev" : "lib/module/prod");
}

function getPackageContents(moduleDirectory, moduleName) {
  const packageFileName = path.resolve(moduleDirectory, moduleName, "./package.json");
  if (!fs.existsSync(packageFileName))
    return {};
  const packageFileContents = fs.readFileSync(packageFileName, "utf8");
  return JSON.parse(packageFileContents);
}

function isFile(fileName) {
  fs.statSync(fileName);
}

function linkRecursive(sourceDirectory, outputDirectory) {
  const entries = fs.readdirSync(sourceDirectory);
  // first go through and link all the files.
  for (thisEntry of entries) {
    sourceFile = path.resolve(sourceDirectory, thisEntry);
    const stats = fs.statSync(sourceFile);
    if (stats.isFile()) {
      outputFile = path.resolve(outputDirectory, thisEntry);
      if (!fs.existsSync(outputFile)) {
        fs.symlinkSync(sourceFile, outputFile);
      }
    }
  }

  // then go through and do all the subdirectories.
  for (thisEntry of entries) {
    sourceSubDirectory = path.resolve(sourceDirectory, thisEntry);
    const stats = fs.statSync(sourceSubDirectory);
    if (stats.isDirectory()) {
      // go through the subdirectory
      outputSubDirectory = path.resolve(outputDirectory, thisEntry);
      if (!fs.existsSync(outputSubDirectory))
        fs.mkdirSync(outputSubDirectory, { recursive: true });
      linkRecursive(sourceSubDirectory, outputSubDirectory);
    }
  }
}

function linkStaticFiles(sourceDirectory, outputDirectory) {
  const sourceStaticDirectory = path.resolve(sourceDirectory, "static");
  if (fs.existsSync(sourceStaticDirectory)) {
    const outStaticDirectory = path.resolve(outputDirectory, "static");
    if (!fs.existsSync(outStaticDirectory))
      fs.mkdirSync(outStaticDirectory);
    linkRecursive(sourceStaticDirectory, outStaticDirectory);
  }
}

function linkPublicStaticFiles(sourcePublicDirectory, outputPublicDirectory) {
  if (fs.existsSync(sourcePublicDirectory)) {
    linkRecursive(sourcePublicDirectory, outputPublicDirectory);
  }
}

function linkModuleFile(moduleSourceFile, outFilePath) {
  if (!fs.existsSync(outFilePath)) {
    console.log("linking .js file", moduleSourceFile, "to", outFilePath);
    fs.symlinkSync(moduleSourceFile, outFilePath);
  }
  // if there's a map file, link that, too.
  const mapFile = moduleSourceFile + ".map";
  const outMapFile = outFilePath + ".map";
  if (fs.existsSync(mapFile) && !fs.existsSync(outMapFile)) {
    fs.symlinkSync(mapFile, outMapFile);
    console.log("linking .js.map file", mapFile, "to", outMapFile);
  }
}

class ModuleInfo {
  constructor(inRushRepo, moduleName, relativePath, publicResourceDirectory) {
    this.inRushRepo = inRushRepo;
    this.moduleName = moduleName;
    this.relativePath = relativePath;
    this.publicResourceDirectory = publicResourceDirectory;
  }
}

// this function adds either dependencies or peerDependencies.
function AddListOfDependents(packagePath, dependentList, packageFileContents, packageKey, depth) {
  const newDependents = [];
  for (const dependent in packageFileContents[packageKey]) {
    alreadyHave = false;
    for (existingDependent of dependentList) {
      if (dependent === existingDependent.name) {
        alreadyHave = true;
        break;
      }
    }
    if (!alreadyHave) {
      newDependents.push({packagePath, name: dependent, version: packageFileContents[packageKey][dependent]});
    }
  }

  // add the newly discovered dependents to the current list of dependents.
  for (newDependent of newDependents) {
    dependentList.push(newDependent);
  }

  if (depth < 2) {
    for (newDependent of newDependents) {
      const dependentNodeModules = path.resolve(packagePath, "node_modules");
      AddDependents(dependentList, dependentNodeModules, newDependent.name, depth + 1);
    }
  }
}

// this function adds the dependencies and peerDependencies from the specifed package.
function AddDependents (dependentList, packagePath, packageName, depth) {
  const packageFileContents = getPackageContents(packagePath, packageName);

  // get both the dependencies and the peerDependencies.
  const childPackagePath = path.join(packagePath, packageName);
  AddListOfDependents(childPackagePath, dependentList, packageFileContents, "dependencies", depth + 1);
  AddListOfDependents(childPackagePath, dependentList, packageFileContents, "peerDependencies", depth + 1);
}

// these are the modules that we have specified as externals when we webpack
function main() {
  const buildType = (argv.type == undefined) ? "dev" : argv.type;
  const isDev = buildType === "dev";
  const localNodeModules = path.resolve(process.cwd(), "node_modules");
  if (!fs.existsSync(localNodeModules)) {
    console.log("Local node modules directory", localNodeModules, "does not exist, aborting");
    return;
  }

  const externalModules = [
    new ModuleInfo(true, "@bentley/bentleyjs-core", undefined),
    new ModuleInfo(true, "@bentley/geometry-core", undefined),
    new ModuleInfo(false, "@bentley/bwc", makeModuleRelativePath("@bentley/bwc", isDev ? "lib/module/dev/bwc.js" : "lib/module/prod/bwc.js")),
    new ModuleInfo(true, "@bentley/imodeljs-i18n", undefined),
    new ModuleInfo(true, "@bentley/imodeljs-clients", undefined),
    new ModuleInfo(true, "@bentley/imodeljs-common", undefined),
    new ModuleInfo(true, "@bentley/imodeljs-quantity", undefined),
    new ModuleInfo(true, "@bentley/imodeljs-frontend", undefined, "lib/public"),
    new ModuleInfo(true, "@bentley/ui-core", undefined, "lib/public"),
    new ModuleInfo(true, "@bentley/ui-components", undefined, "lib/public"),
    new ModuleInfo(true, "@bentley/ui-framework", undefined, "lib/public"),
    new ModuleInfo(true, "@bentley/ui-ninezone", undefined),
    new ModuleInfo(true, "@bentley/presentation-common", undefined),
    new ModuleInfo(true, "@bentley/presentation-components", undefined),
    new ModuleInfo(true, "@bentley/presentation-frontend", undefined),
    new ModuleInfo(false, "react", makeModuleRelativePath("react", isDev ? "umd/react.development.js" : "umd/react.production.min.js")),
    new ModuleInfo(false, "react-dnd", makeModuleRelativePath("react-dnd", isDev ? "dist/ReactDnd.js" : "dist/ReactDnD.min.js")),
    new ModuleInfo(false, "react-dnd-html5-backend", makeModuleRelativePath("react-dnd-html5-backend", isDev ? "dist/ReactDnDHTML5Backend.js" : "dist/ReactDnDHTML5Backend.min.js")),
    new ModuleInfo(false, "react-dom", makeModuleRelativePath("react-dom", isDev ? "umd/react-dom.development.js" : "umd/react-dom.production.min.js")),
    new ModuleInfo(false, "react-redux", makeModuleRelativePath("react-redux", isDev ? "dist/react-redux.js" : "dist/react-redux.min.js")),
    new ModuleInfo(false, "redux", makeModuleRelativePath("redux", isDev ? "dist/redux.js" : "dist/redux.min.js")),
    new ModuleInfo(false, "inspire-tree", makeModuleRelativePath("inspire-tree", isDev ? "dist/inspire-tree.js" : "dist/inspire-tree.min.js")),
    new ModuleInfo(false, "lodash", makeModuleRelativePath("lodash", isDev ? "lodash.js" : "lodash.min.js")),
  ];

  try {
    const outputDirectory = path.resolve(process.cwd(), argv.destDir);
    // create the output directory, if it doesn't exist.
    if (!fs.existsSync(outputDirectory)) {
      fs.mkdirSync(outputDirectory, { recursive: true });
    }

    // read package.json for this package, and the package.json for its dependents recursively (to depth 2) to the sub-dependencies of the iModelJs modules.
    const dependentList = []; // array of DependentInfos
    AddDependents(dependentList, process.cwd(), "", 0);

    for (const dependent of dependentList) {
      // see if it matches one of our externals.
      for (const externalModule of externalModules) {
        if (dependent.name === externalModule.moduleName) {
          // yes, link the file.
          let fileName = "";
          let moduleSourceFile = undefined;
          let versionString = undefined;

          if (externalModule.inRushRepo) {
            // These are our iModelJs modules. Get the version from the package.json file.
            versionString = dependent.version;
            const moduleSourcePath = makeBentleyModulePath(dependent.packagePath, externalModule.moduleName, isDev);
            fileName = externalModule.moduleName.slice(9) + ".js";
            moduleSourceFile = path.resolve(moduleSourcePath, fileName);
          } else {
            moduleSourceFile = path.resolve(dependent.packagePath, "node_modules", externalModule.relativePath);
            if (0 === externalModule.moduleName.indexOf("@bentley")) {
              // this is for @bentley/bwc -
              fileName = externalModule.moduleName.slice(9) + ".js";
            }
            else {
              fileName = externalModule.moduleName + ".js";
            }
          }
          if (!fs.existsSync(moduleSourceFile)) {
            console.log("problem: File", moduleSourceFile, "does not exist");
          } else {
            let outFilePath = undefined;
            if (versionString) {
              // create subdirectory if needed.
              const outSubDirectory = path.resolve(outputDirectory, "v" + versionString);
              if (!fs.existsSync(outSubDirectory)) {
                fs.mkdirSync(outSubDirectory, { recursive: true });
              }
              outFilePath = path.resolve(outSubDirectory, fileName)
            } else {
              outFilePath = path.resolve(outputDirectory, fileName);
            }
            linkModuleFile(moduleSourceFile, outFilePath);
            if (externalModule.publicResourceDirectory) {
              const publicPath = path.resolve(dependent.packagePath, "node_modules", externalModule.moduleName, externalModule.publicResourceDirectory);
              linkPublicStaticFiles(publicPath, outputDirectory);
            }
            // found dependent in list of external, no need to look at the rest of the externals.
            break;
          }
        }
      }
    }

    // link the IModelJsLoader.js from imodeljs/frontend also. NOTE: imodeljs-frontend must always be in package.json's dependencies.
    const loaderPath = makeBentleyModulePath(process.cwd(), "@bentley/imodeljs-frontend", isDev);
    const loaderFile = path.resolve(loaderPath, "IModelJsLoader.js");
    const outFilePath = path.resolve(outputDirectory, "IModelJsLoader.js");
    linkModuleFile(loaderFile, outFilePath);
  } catch (e) {
    console.log("Error", e);
  }
}

main();
