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

// description of each node_module.
class ModuleInfo {
  constructor(isDevelopment, useVersion, moduleName, relativePath, publicResourceDirectory) {
    this.useVersion = useVersion;
    this.moduleName = moduleName;
    this.relativePath = relativePath;
    this.publicResourceDirectory = publicResourceDirectory;
    // if relativePath not supplied, it's one of our @bentley modules and we can figure it out.
    if (!this.relativePath) {
      this.fileName = (0 === moduleName.indexOf("@bentley")) ? moduleName.slice(9) + ".js" : moduleName + ".js";
      this.relativePath = path.join(moduleName, isDevelopment ? "lib/module/dev" : "lib/module/prod", this.fileName);
    } else {
      this.fileName = this.moduleName + ".js";
    }
  }
}

class DependentInfo {
  constructor(name, packageRoot, parentPackageRoot, externalModule, version) {
    this.name = name;
    this.packageRoot = packageRoot;
    this.parentPackageRoot = parentPackageRoot;
    this.externalModule = externalModule;
    this.version = version;
  }
}

// class that copies (actually symlinks) the external modules needed my iModel.js into the web resources directory.
class ModuleCopier {

  // these are all modules that are listed as external in our webpack configuration, and therefore need to be copied to the web resources directory.
  constructor(nodeModulesDirectory, isDevelopment) {
    this.nodeModulesDirectory = nodeModulesDirectory;
    this.dependentList = [];
    this.isDevelopment = isDevelopment;
    this.externalModules = [
      new ModuleInfo(isDevelopment, true, "@bentley/bentleyjs-core", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/geometry-core", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/imodeljs-i18n", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/imodeljs-clients", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/imodeljs-common", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/imodeljs-quantity", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/imodeljs-frontend", undefined, "lib/public"),
      new ModuleInfo(isDevelopment, true, "@bentley/ui-core", undefined, "lib/public"),
      new ModuleInfo(isDevelopment, true, "@bentley/ui-components", undefined, "lib/public"),
      new ModuleInfo(isDevelopment, true, "@bentley/ui-framework", undefined, "lib/public"),
      new ModuleInfo(isDevelopment, true, "@bentley/ui-ninezone", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/presentation-common", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/presentation-components", undefined),
      new ModuleInfo(isDevelopment, true, "@bentley/presentation-frontend", undefined),
      new ModuleInfo(isDevelopment, false, "react", path.join("react", isDevelopment ? "umd/react.development.js" : "umd/react.production.min.js")),
      new ModuleInfo(isDevelopment, false, "react-dnd", path.join("react-dnd", isDevelopment ? "dist/ReactDnD.js" : "dist/ReactDnD.min.js")),
      new ModuleInfo(isDevelopment, false, "react-dnd-html5-backend", path.join("react-dnd-html5-backend", isDevelopment ? "dist/ReactDnDHTML5Backend.js" : "dist/ReactDnDHTML5Backend.min.js")),
      new ModuleInfo(isDevelopment, false, "react-dom", path.join("react-dom", isDevelopment ? "umd/react-dom.development.js" : "umd/react-dom.production.min.js")),
      new ModuleInfo(isDevelopment, false, "react-redux", path.join("react-redux", isDevelopment ? "dist/react-redux.js" : "dist/react-redux.min.js")),
      new ModuleInfo(isDevelopment, false, "redux", path.join("redux", isDevelopment ? "dist/redux.js" : "dist/redux.min.js")),
      new ModuleInfo(isDevelopment, false, "inspire-tree", path.join("inspire-tree", isDevelopment ? "dist/inspire-tree.js" : "dist/inspire-tree.min.js")),
      new ModuleInfo(isDevelopment, false, "lodash", path.join("lodash", isDevelopment ? "lodash.js" : "lodash.min.js")),
    ];
  }

  // reads the package contents for the given module.
  static readPackageContents(packageRoot) {
    const packageFileName = path.resolve(packageRoot, "./package.json");
    if (!fs.existsSync(packageFileName))
      return {};

    const packageFileContents = fs.readFileSync(packageFileName, "utf8");
    return JSON.parse(packageFileContents);
  }

  // links all files in the source directory to the output directory, recursively through subdirectories.
  static symlinkRecursive(sourceDirectory, outputDirectory) {
    const entries = fs.readdirSync(sourceDirectory);
    // first go through and link all the files.
    for (const thisEntry of entries) {
      const sourceFile = path.resolve(sourceDirectory, thisEntry);
      const stats = fs.statSync(sourceFile);
      if (stats.isFile()) {
        const outputFile = path.resolve(outputDirectory, thisEntry);
        if (!fs.existsSync(outputFile)) {
          fs.symlinkSync(sourceFile, outputFile);
        }
      }
    }

    // then go through and do all the subdirectories.
    for (const thisEntry of entries) {
      const sourceSubDirectory = path.resolve(sourceDirectory, thisEntry);
      const stats = fs.statSync(sourceSubDirectory);
      if (stats.isDirectory()) {
        // go through the subdirectory
        const outputSubDirectory = path.resolve(outputDirectory, thisEntry);
        if (!fs.existsSync(outputSubDirectory))
          fs.mkdirSync(outputSubDirectory, { recursive: true });
        ModuleCopier.symlinkRecursive(sourceSubDirectory, outputSubDirectory);
      }
    }
  }

  // symlinks the public static files from a module into the output web resources directories.
  static symlinkPublicStaticFiles(sourcePublicDirectory, outputPublicDirectory) {
    if (fs.existsSync(sourcePublicDirectory)) {
      ModuleCopier.symlinkRecursive(sourcePublicDirectory, outputPublicDirectory);
    }
  }

  // symlinks the module file and source map file if available.
  static symlinkModuleFile(moduleSourceFile, outFilePath) {
    // symlink the module file.
    if (!fs.existsSync(outFilePath)) {
      fs.symlinkSync(moduleSourceFile, outFilePath);
    }

    // if there's a source map file, link that, too.
    const mapFile = moduleSourceFile + ".map";
    const outMapFile = outFilePath + ".map";
    if (fs.existsSync(mapFile) && !fs.existsSync(outMapFile)) {
      fs.symlinkSync(mapFile, outMapFile);
    }
  }

  // this function adds the dependencies found in package.json that are external modules. Recurses, but only to depth 1.
  findExternalModuleDependents(parentPackageRoot, depth) {
    const packageFileContents = ModuleCopier.readPackageContents(parentPackageRoot);

    // find new dependents from this packageFileContents
    const newDependents = [];
    for (const dependent in packageFileContents.dependencies) {
      // see if we already have this dependent.
      if (undefined !== this.dependentList.find((existingDependent) => { return (existingDependent.name === dependent); })) {
        continue;
      }
      // we only care about external modules and their dependents that might be external modules.
      for (const externalModule of this.externalModules) {
        if (externalModule.moduleName === dependent) {
          const dependentPackageRoot = path.resolve(parentPackageRoot, "node_modules", dependent);
          newDependents.push(new DependentInfo(dependent, dependentPackageRoot, parentPackageRoot, externalModule, packageFileContents.dependencies[dependent]));
        }
      }
    }

    // add the newly discovered dependents to the master list of dependents.
    for (const newDependent of newDependents) {
      this.dependentList.push(newDependent);
    }

    // we need to check the first level of dependents of our direct dependents to find the non-imodeljs dependencies like lodash, react, redux, etc.
    if (depth < 2) {
      for (const newDependent of newDependents) {
        this.findExternalModuleDependents(newDependent.packageRoot, depth + 1);
      }
    }
  }

  // finds peerDependencies and makes sure they are in the list of dependencies.
  checkPeerDependencies() {
    let peerMissing = false;
    const missingList = [];
    for (const thisDependent of this.dependentList) {
      const packageFileContents = ModuleCopier.readPackageContents(thisDependent.packageRoot);
      for (const peerDependent in packageFileContents.peerDependencies) {
        // don't bother to a peerDependent twice.
        if (-1 !== missingList.indexOf(peerDependent))
          continue;

        // we only report miss peerDependencies of our external modules.
        if (undefined === (this.externalModules.find((externalModule) => { return (externalModule.moduleName === peerDependent); })))
          continue;

        if (undefined === this.dependentList.find((thisDependent) => { return (thisDependent.name === peerDependent); })) {
          console.log("Dependent", thisDependent.name, "requires a peerDependency of", peerDependent, "but none found. Add ", peerDependent, "to dependencies in package.json");
          missingList.push(peerDependent);
          peerMissing = true;
        }
      }
    }
    return peerMissing ? 1 : 0
  }

  // finds the source module file. It is either relative to our localNodeModules, or relative to the dependent path where we found the package file.
  findExternalModuleFile(dependent, relativePath) {
    const localNodeModuleFile = path.resolve(this.nodeModulesDirectory, relativePath);
    if (fs.existsSync(localNodeModuleFile))
      return localNodeModuleFile;

    const dependentNodeModuleFile = path.resolve(dependent.parentPackageRoot, "node_modules", relativePath);
    if (fs.existsSync(dependentNodeModuleFile))
      return dependentNodeModuleFile;

    return undefined;
  }

  // finds dependents, symlinks them to destination directory.
  symlinkExternalModules(relativeDestinationDir) {
    try {
      const outputDirectory = path.resolve(process.cwd(), relativeDestinationDir);
      // create the output directory, if it doesn't exist.
      if (!fs.existsSync(outputDirectory)) {
        fs.mkdirSync(outputDirectory, { recursive: true });
      }

      // Read the package file for the current directory, and add the dependents recursively (to depth 2) to the sub-dependencies of the iModelJs modules.
      this.findExternalModuleDependents(process.cwd(), 0);
      if (this.checkPeerDependencies())
        return 1;

      let missingModule = false;
      for (const dependent of this.dependentList) {
        const externalModule = dependent.externalModule;
        const versionString = (externalModule.useVersion) ? dependent.version : undefined;

        const moduleSourceFile = this.findExternalModuleFile(dependent, externalModule.relativePath)

        // report all the module files we can't find.
        if (!moduleSourceFile) {
          console.log("Unable to locate required module file", externalModule.moduleName, " - looking for relative path ", externalModule.relativePath);
          missingModule = true;
        } else {
          let outFilePath = outputDirectory;
          if (versionString) {
            outFilePath = path.resolve(outputDirectory, "v" + versionString);
            // create subdirectory if needed.
            if (!fs.existsSync(outFilePath)) {
              fs.mkdirSync(outFilePath, { recursive: true });
            }
          }
          const fullFilePath = path.resolve(outFilePath, externalModule.fileName);
          ModuleCopier.symlinkModuleFile(moduleSourceFile, fullFilePath);

          // symlink the external modules resource files if necessary.
          if (externalModule.publicResourceDirectory) {
            const publicPath = path.resolve(dependent.packageRoot, externalModule.publicResourceDirectory);
            ModuleCopier.symlinkPublicStaticFiles(publicPath, outputDirectory);
          }
        }
      }

      if (missingModule)
        return 1;

      // link the IModelJsLoader.js from imodeljs/frontend also. NOTE: imodeljs-frontend must always be in package.json's dependencies.
      const loaderFile = path.resolve(process.cwd(), "node_modules/@bentley/imodeljs-frontend", this.isDevelopment ? "lib/module/dev/IModelJsLoader.js" : "lib/module/prod/IModelJsLoader.js");
      ModuleCopier.symlinkModuleFile(loaderFile, path.resolve(outputDirectory, "iModelJsLoader.js"));

    } catch (e) {
      console.log("Error", e);
      return 1;
    }
    return 0;
  }
}

function main() {
  const buildType = (argv.type == undefined) ? "dev" : argv.type;
  const isDevelopment = buildType === "dev";
  const localNodeModules = path.resolve(process.cwd(), "node_modules");
  if (!fs.existsSync(localNodeModules)) {
    console.log("Local node modules directory", localNodeModules, "does not exist, aborting");
    return 1;
  }

  const moduleCopier = new ModuleCopier(localNodeModules, isDevelopment);
  return moduleCopier.symlinkExternalModules(argv.destDir);
}

// run the ModuleCopier
process.exitCode = main();
