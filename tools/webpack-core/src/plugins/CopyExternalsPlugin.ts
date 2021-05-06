/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as chalk from "chalk";
import * as fs from "fs-extra";
import * as path from "path";
import { Compiler } from "webpack";
import { getAppRelativePath, getPaths } from "../utils/paths";
const getAllDependencies = require("../utils/resolve-recurse/resolve");
import { Dependency } from "../utils/resolve-recurse/resolve";
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const { builtinModules } = require("module");
const WebpackError = require("webpack/lib/WebpackError");
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
    const paths = getPaths();
    const appPackageJson = require(paths.appPackageJson);
    // NEEDSWORK: We need to special case imodeljs-native now that it is not an explicit dependency of most apps.
    // This is a bit of a hack, but it's easier to just do this for now than build out the entire dependency tree...
    this._appDependencies = new Set([...Object.keys(appPackageJson.dependencies), "@bentley/imodeljs-native"]);
  }

  public apply(compiler: Compiler) {
    compiler.hooks.compilation.tap("CopyExternalsPlugin", (compilation: any) => {
      this._logger = compilation.getLogger("CopyExternalsPlugin");
      compilation.hooks.buildModule.tap("CopyExternalsPlugin", (currentModule: any) => {
        if (currentModule.external) {
          this._promises.push(this.handleModule(currentModule, compiler.outputPath));
        }
      });
    });

    compiler.hooks.afterEmit.tapPromise("CopyExternalsPlugin", async () => {
      await Promise.all(this._promises);
    });
  }

  public async handleModule(currentModule: any, outputDir: string) {
    const pkgName = this.pathToPackageName(currentModule.request);
    if (pkgName === "electron" || builtinModules.includes(pkgName) || this._copiedPackages.has(pkgName)) {
      return;
    }
    const packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [currentModule.issuer.context] });
    await this.copyPackage(pkgName, outputDir, path.dirname(packageJsonPath));
    if (!packageJsonPath)
      return;

    this._copiedPackages.add(pkgName);

    const packageJson = require(packageJsonPath);
    if (!packageJson.dependencies && !packageJson.optionalDependencies)
      return;

    // Grab external package's dependencies and all of its dependencies and so on recursively
    const depsFromRecursion = await getAllDependencies({
      path: path.dirname(packageJsonPath),
    });
    await this.recurseDependencies(depsFromRecursion.dependencies, outputDir);
  }
  // TODO: Optimize recursion, too many awaits.
  private async recurseDependencies(dependencies: Dependency[], outputDir: string) {
    if (dependencies.length === 0)
      return;
    for (const dep of dependencies) {
      if (this._copiedPackages.has(dep.name))
        continue;
      await this.copyPackage(dep.name, outputDir, path.dirname(`${dep.path}/package.json`)); // add package.json to end so that path.dirname in copyPackage gets proper directory instead of the dir above it.
      this._copiedPackages.add(dep.name);
      await this.recurseDependencies(dep.dependencies, outputDir);
    }
  }

  private async copyPackage(pkgName: string, outDir: string, pathToPackage: string) {
    this._logger.log(`Copying ${getAppRelativePath(pathToPackage)} to ${getAppRelativePath(path.resolve(outDir, "node_modules"))}`);
    await fs.copy(pathToPackage, path.resolve(outDir, "node_modules", pkgName), { dereference: true });
  }

  private pathToPackageName(p: string) {
    const parts = p.replace(/^.*node_modules[\\\/]/, "").split(/[\\\/]/);
    return (parts[0].startsWith("@")) ? `${parts[0]}/${parts[1]}` : parts[0];
  }
}
