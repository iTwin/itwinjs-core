/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import { Compiler } from "webpack";
import { getAppRelativePath, getSourcePosition, paths } from "../utils/paths";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const { builtinModules } = require("module");
const WebpackError = require("webpack/lib/WebpackError");
const ModuleDependencyWarning = require("webpack/lib/ModuleDependencyWarning");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

class MissingExternalWarning extends WebpackError {
  constructor(pkgName: string) {
    super();

    this.name = "MissingExternalWarning";
    this.message = `\nCan't copy external package "${pkgName}" because it is not a direct dependency.\n`;
    this.message = `${this.message}To fix this, run ${chalk.cyan(`npm install -P ${pkgName}`)}`;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class CopyExternalsPlugin {
  private _promises: Array<Promise<any>> = [];
  private _copiedPackages: Set<string> = new Set();
  private _appDependencies: Set<string>;
  private _logger: any;

  constructor() {
    const appPackageJson = require(paths.appPackageJson);
    // NEEDSWORK: We need to special case imodeljs-native now that it is not an explicit dependency of most apps.
    // This is a bit of a hack, but it's easier to just do this for now than build out the entire dependency tree...
    this._appDependencies = new Set([...Object.keys(appPackageJson.dependencies), "@bentley/imodeljs-native"]);
  }

  public apply(compiler: Compiler): void {
    compiler.hooks.compilation.tap("CopyExternalsPlugin", (compilation: any) => {
      this._logger = compilation.getLogger("CopyExternalsPlugin");
      compilation.hooks.buildModule.tap("CopyExternalsPlugin", (currentModule: any) => {
        if (currentModule.external) {
          this._promises.push(this.handleModule(currentModule, compiler.outputPath, compilation));
        }
      });
    });

    compiler.hooks.afterEmit.tapPromise("CopyExternalsPlugin", async () => {
      await Promise.all(this._promises);
    });
  }

  public async handleModule(currentModule: any, outputDir: string, compilation: any): Promise<void> {
    const pkgName = this.pathToPackageName(currentModule.request);
    if (pkgName === "electron" || builtinModules.includes(pkgName) || this._copiedPackages.has(pkgName))
      return;

    if (!this._appDependencies.has(pkgName)) {
      this._logger.warn(`Can't copy package "${pkgName}" - it is not a direct dependency.`);
      for (const reason of currentModule.reasons) {
        if (!reason.module || !reason.dependency)
          continue;

        this._logger.log(`"${pkgName}" included at ${getSourcePosition(reason.module, reason.dependency.loc)}`);

        if (!reason.dependency.optional) {
          compilation.warnings.push(new ModuleDependencyWarning(reason.module, new MissingExternalWarning(pkgName), reason.dependency.loc));
        }
      }
      return;
    }

    const packageJsonPath = await this.copyPackage(pkgName, outputDir);
    if (!packageJsonPath)
      return;

    this._copiedPackages.add(pkgName);

    const packageJson = require(packageJsonPath);
    if (!packageJson.dependencies && !packageJson.optionalDependencies)
      return;

    const dependencies = [...Object.keys(packageJson.dependencies || {}), ...Object.keys(packageJson.optionalDependencies || {})];
    for (const dep of dependencies) {
      if (!this._copiedPackages.has(dep)) {
        await this.copyPackage(dep, outputDir, path.dirname(packageJsonPath));
        this._copiedPackages.add(dep);
      }
    }
  }

  private async copyPackage(pkgName: string, outDir: string, parentPath?: string) {
    const packageJsonPath = this.findPackageJson(pkgName, parentPath);
    if (!packageJsonPath)
      return;

    if (!parentPath || !packageJsonPath.startsWith(parentPath)) {
      this._logger.log(`Copying ${getAppRelativePath(path.dirname(packageJsonPath))} to ${getAppRelativePath(path.resolve(outDir, "node_modules"))}`);
      await fs.copy(path.dirname(packageJsonPath), path.resolve(outDir, "node_modules", pkgName), { dereference: true });
    }
    return packageJsonPath;
  }

  private pathToPackageName(p: string) {
    const parts = p.replace(/^.*node_modules[\\\/]/, "").split(/[\\\/]/);
    return (parts[0].startsWith("@")) ? `${parts[0]}/${parts[1]}` : parts[0];
  }

  private findPackageJson(pkgName: string, parentPath?: string) {
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
      return require.resolve(`${pkgName}/package.json`, { paths: searchPaths });
    } catch (error) {
      return undefined;
    }
  }
}
