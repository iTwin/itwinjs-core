/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2017 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
const chalk = require('chalk');
const path = require('path');
const paths = require('../../config/paths');

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
};
