/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import type { Compiler } from "webpack";
import { getAppRelativePath, getSourcePosition } from "../utils/paths";
const { resolveRecurse } = require("../utils/resolve-recurse/resolve");
import type { Dependency } from "../utils/resolve-recurse/resolve";
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const { builtinModules } = require("module");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
export class CopyExternalsPlugin {
  private _promises: Array<Promise<any>> = [];
  private _copiedPackages: Set<string> = new Set();
  private _logger: any;

  public apply(compiler: Compiler) {
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

  public async handleModule(currentModule: any, outputDir: string, compilation: any) {
    const pkgName = this.pathToPackageName(currentModule.request);
    if (pkgName === "electron" || builtinModules.includes(pkgName) || this._copiedPackages.has(pkgName))
      return;

    let packageJsonPath = "";
    try {
      packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [currentModule.issuer.context] });
    } catch (error) {
      // Always _log_ missing externals as a warning, but don't add it as a compilation warning if it's an "optional" dependency.
      const warning = `Can't copy external package "${pkgName}" - it is not installed.`;
      this._logger.warn(warning);
      for (const reason of currentModule.reasons) {
        if (!reason.module || !reason.dependency)
          continue;

        const location = getSourcePosition(reason.module, reason.dependency.loc);
        this._logger.log(`"${pkgName}" included at ${location}`);
        if (!reason.dependency.optional)
          compilation.warnings.push(`${location}\n${warning}\nTo fix this, either npm install ${pkgName} or wrap the import in a try/catch.`);
      }
      return;
    }

    await this.copyPackage(pkgName, outputDir, path.dirname(packageJsonPath));
    if (!packageJsonPath)
      return;

    this._copiedPackages.add(pkgName);

    const packageJson = require(packageJsonPath);
    if (!packageJson.dependencies && !packageJson.optionalDependencies)
      return;

    // Grab external package's dependencies and all of its dependencies and so on recursively
    const depsFromRecursion = await resolveRecurse({
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
