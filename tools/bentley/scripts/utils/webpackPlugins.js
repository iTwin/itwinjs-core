/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const glob = require('glob');
const paths = require('../config/paths');

class BanImportsPlugin {
  constructor(bundleName, bannedName, bannedDir, bannedRegex) {
    this.bundleName = bundleName;
    this.bannedName = bannedName;
    this.bannedDir = bannedDir;
    this.bannedRegex = bannedRegex;
  }

  apply(resolver) {
    resolver.plugin('file', (request, callback) => {
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

class CopyNativeAddonsPlugin {
  constructor(options) {}

  apply(compiler) {
    compiler.plugin('environment', () => {
      const packageLock = require(paths.appPackageLockJson);
      const dir = path.resolve(paths.appNodeModules, "**/*.node");
      const matches = glob.sync(dir)

      matches.push("@bentley/imodeljs-native-platform-node");
      matches.push("@bentley/imodeljs-native-platform-api");
      matches.push("@bentley/imodeljs-native-platform-electron");

      for (const match of matches) {
        const nativeDependency = pathToPackageName(match);

        if (!packageLock.dependencies[nativeDependency] || !packageLock.dependencies[nativeDependency].dev)
          fs.copySync(path.resolve(paths.appNodeModules, nativeDependency), path.resolve(paths.appDist, "node_modules", nativeDependency), { dereference: true });
      }
    });
  }
}

class CopyAssetsPlugin {
  apply(compiler) {
    compiler.plugin('environment', () => {
      if (fs.existsSync(paths.appAssets))
        fs.copySync(paths.appAssets, path.resolve(paths.appDist, "assets"));
    });
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

module.exports = {
  BanFrontendImportsPlugin,
  BanBackendImportsPlugin,
  CopyNativeAddonsPlugin,
  CopyAssetsPlugin,
};
