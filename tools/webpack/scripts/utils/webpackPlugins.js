/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
const chalk = require("chalk");
const path = require("path");
const fs = require("fs-extra");
const paths = require("../../config/paths");

class BanImportsPlugin {
  constructor(bundleName, bannedName, bannedDir, bannedRegex) {
    this.bundleName = bundleName;
    this.bannedName = bannedName;
    this.bannedDir = bannedDir;
    this.bannedRegex = bannedRegex;
  }

  apply(resolver) {
    resolver.hooks.file.tapAsync(this.constructor.name, (request, contextResolver, callback) => {
      if (!request.context.issuer || !request.__innerRequest_request)
        return callback();

      if (this.bannedRegex.test(request.path) || request.path.startsWith(this.bannedDir)) {
        const actualRequest = request.__innerRequest_request.replace(/^\.[\/\\]/, ""); // not sure why __innerRequest_request always starts with ./
        const errorMessage = chalk.red("You are importing ") + chalk.yellow(actualRequest) + chalk.red(".  ")
          + chalk.red.bold(this.bannedName) + chalk.red(" code should not be included in the ")
          + chalk.red.bold(this.bundleName) + chalk.red(" bundle.");
        return callback(new Error(errorMessage), request);
      }

      return callback();
    });
  }
}

function pathToPackageName(p) {
  const parts = p.replace(/^.*node_modules[\\\/]/, "").split(/[\\\/]/);
  return (parts[0].startsWith("@")) ? parts[0] + "/" + parts[1] : parts[0];
}

function findPackageJson(pkgName, parentPath) {
  const searchPaths = [];
  if (parentPath) {
    const parentNodeModules = path.resolve(parentPath, "node_modules");
    const parentContainingDir = parentPath.replace(/^(.*node_modules).*$/, "$1");
    searchPaths.push(parentNodeModules, parentContainingDir);
  }
  // Also search in node_modules/@bentley/imodeljs-backend, since we can't rely on imodeljs-native being hoisted in a rush monorepo.
  searchPaths.push(path.join(paths.appNodeModules, "@bentley", "imodeljs-backend"));
  searchPaths.push(paths.appNodeModules);

  try {
    return require.resolve(pkgName + "/package.json", { paths: searchPaths });
  } catch (error) {
    return undefined;
  }
}

async function copyPackage(pkgName, parentPath) {
  const packageJsonPath = findPackageJson(pkgName, parentPath);
  if (!packageJsonPath)
    return;

  if (!parentPath || !packageJsonPath.startsWith(parentPath)) {
    // console.log(chalk.gray(`Copying ${path.dirname(packageJsonPath)} to lib/node_modules`));
    await fs.copy(path.dirname(packageJsonPath), path.resolve(paths.appLib, "node_modules", pkgName), { dereference: true });
  }
  return packageJsonPath;
}


class AbstractAsyncStartupPlugin {
  constructor(name) {
    this._name = name;
  }

  apply(compiler) {
    compiler.hooks.environment.tap(this._name, () => {
      this.promise = this.runAsync(compiler)
    });
    compiler.hooks.afterEmit.tapPromise(this._name, async () => {
      await this.promise;
    });
  }
}

class CopyNativeAddonsPlugin extends AbstractAsyncStartupPlugin {
  constructor(options) {
    super("CopyNativeAddonsPlugin");
  }

  async runAsync(compiler) {
    const appPackageJson = require(paths.appPackageJson);
    // NEEDSWORK: We need to special case imodeljs-native now that it is not an explicit dependency of most apps.
    // This is a bit of a hack, but it's easier to just do this for now than build out the entire dependency tree...
    const appDependencies = new Set([...Object.keys(appPackageJson.dependencies), "@bentley/imodeljs-native"]);
    let packagesToCopy = [];

    // Copy any modules excluded from the bundle via the "externals" webpack config option
    const externals = compiler.options.externals;
    if (typeof (externals) === "object") {
      if (Array.isArray(externals))
        packagesToCopy = externals.filter((ext) => typeof (ext) === "string");
      else
        packagesToCopy = Object.keys(externals);
    }

    const copiedPackages = new Set();
    for (const pkg of packagesToCopy) {
      const pkgName = pathToPackageName(pkg);
      if (copiedPackages.has(pkgName) || !appDependencies.has(pkgName))
        continue;

      const packageJsonPath = await copyPackage(pkgName);
      if (!packageJsonPath)
        continue;

      copiedPackages.add(pkgName);

      const packageJson = require(packageJsonPath);
      if (!packageJson.dependencies && !packageJson.optionalDependencies)
        continue;

      const dependencies = [...Object.keys(packageJson.dependencies || {}), ...Object.keys(packageJson.optionalDependencies || {})];
      for (const dep of dependencies) {
        if (!copiedPackages.has(dep)) {
          await copyPackage(dep, path.dirname(packageJsonPath));
          copiedPackages.add(dep);
        }
      }
    }
  }
}

async function isDirectory(directoryName) {
  return (await fs.stat(directoryName)).isDirectory();
}

async function tryCopyDirectoryContents(source, target) {
  if (!(await fs.exists(source)))
    return;

  const copyOptions = { dereference: true, preserveTimestamps: true, overwrite: false, errorOnExist: false };
  try {
    if (await isDirectory(source) && await fs.exists(target) && await isDirectory(target)) {
      for (const name of await fs.readdir(source)) {
        await tryCopyDirectoryContents(path.join(source, name), path.join(target, name));
      }
    }
    else {
      await fs.copy(source, target, copyOptions);
    }
  } catch (err) {
    console.log(`Error trying to copy '${source}' to '${target}': ${err.toString()}`);
  }
}
class CopyBentleyStaticResourcesPlugin extends AbstractAsyncStartupPlugin {
  constructor(directoryNames) {
    super("CopyBentleyStaticResourcesPlugin");
    this.directoryNames = directoryNames;
  }
  async runAsync(compiler) {
    const bentleyDir = paths.appBentleyNodeModules;
    const subDirectoryNames = await fs.readdir(bentleyDir);
    for (const thisSubDir of subDirectoryNames) {
      if (!(await isDirectory(path.resolve(paths.appBentleyNodeModules, thisSubDir))))
        continue;

      const fullDirName = path.resolve(bentleyDir, thisSubDir);
      for (const staticAssetsDirectoryName of this.directoryNames) {
        await tryCopyDirectoryContents(
          path.join(fullDirName, "lib", staticAssetsDirectoryName),
          path.join(paths.appLib, staticAssetsDirectoryName)
        );
      }
    }
  }
}
class CopyAppAssetsPlugin extends AbstractAsyncStartupPlugin {
  constructor(options) {
    super("CopyAppAssetsPlugin");
  }
  async runAsync(compiler) {
    await tryCopyDirectoryContents(paths.appAssets, path.resolve(paths.appLib, "assets"));
  }
}

class BanFrontendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("BACKEND", "FRONTEND", paths.appSrcFrontend, /imodeljs-frontend/);
  }
}

class BanBackendImportsPlugin extends BanImportsPlugin {
  constructor() {
    super("FRONTEND", "BACKEND", paths.appSrcBackend, /imodeljs-backend/);
  }
}

class WatchBackendPlugin {
  constructor() {
    this.isFirstRun = 0;
    this.prevTimestamp = Date.now();
  }

  apply(compiler) {
    compiler.hooks.emit.tap("WatchBackendPlugin", compilation => {
      const newTimestamp = compilation.fileTimestamps.get(paths.appBuiltMainJs);
      const didBackendChange = this.prevTimestamp < (newTimestamp || -Infinity);
      if (didBackendChange) {
        this.prevTimestamp = newTimestamp;
        compilation.modifyHash(newTimestamp + "");
        return true;
      }
    });
    compiler.hooks.afterCompile.tap("WatchBackendPlugin", compilation => {
      compilation.fileDependencies.add(paths.appBuiltMainJs);
    });
  }
}

module.exports = {
  BanFrontendImportsPlugin,
  BanBackendImportsPlugin,
  CopyNativeAddonsPlugin,
  CopyAppAssetsPlugin,
  CopyBentleyStaticResourcesPlugin,
  WatchBackendPlugin
};
