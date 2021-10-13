/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chalk from "chalk";

class BanImportsPlugin {
  private _bundleName: string;
  private _bannedName: string;
  private _bannedDir: string;
  private _bannedRegex: RegExp;

  constructor(bundleName: string, bannedName: string, bannedDir: string, bannedRegex: RegExp) {
    this._bundleName = bundleName;
    this._bannedName = bannedName;
    this._bannedDir = bannedDir;
    this._bannedRegex = bannedRegex;
  }

  public apply(resolver: any) {
    resolver.hooks.file.tapAsync(this.constructor.name, (request: any, _contextResolver: any, callback: (err?: Error, result?: string) => void) => {
      if (!request.context.issuer || !request.__innerRequest_request)
        return callback();

      if (this._bannedRegex.test(request.path) || request.path.startsWith(this._bannedDir)) {
        const actualRequest = request.__innerRequest_request.replace(/^\.[\/\\]/, ""); // not sure why __innerRequest_request always starts with ./
        const errorMessage = chalk.red("You are importing ") + chalk.yellow(actualRequest) + chalk.red(".  ")
          + chalk.red.bold(this._bannedName) + chalk.red(" code should not be included in the ")
          + chalk.red.bold(this._bundleName) + chalk.red(" bundle.");
        return callback(new Error(errorMessage), request);
      }

      return callback();
    });
  }
}

export class BanFrontendImportsPlugin extends BanImportsPlugin {
  constructor(localFrontendSrcDir: string) {
    super("BACKEND", "FRONTEND", localFrontendSrcDir, /core-frontend/);
  }
}

export class BanBackendImportsPlugin extends BanImportsPlugin {
  constructor(localBackendSrcDir: string) {
    super("FRONTEND", "BACKEND", localBackendSrcDir, /core-backend/);
  }
}
