/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { Compilation, Compiler, ExternalModule, Module, WebpackError } from "webpack";
import { getAppRelativePath } from "../utils/paths";
const { resolveRecurse } = require("../utils/resolve-recurse/resolve");
import { Dependency } from "../utils/resolve-recurse/resolve";
import { externalPrefix } from "./RequireMagicCommentsPlugin";
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const { builtinModules } = require("module");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

type WebpackLogger = ReturnType<Compilation["getLogger"]>;

export class CopyExternalsPlugin {
  private _promises: Array<Promise<any>> = [];
  private _copiedPackages: Set<string> = new Set();
  private _logger: WebpackLogger | undefined;

  public apply(compiler: Compiler) {
    compiler.hooks.compilation.tap("CopyExternalsPlugin", (compilation: Compilation) => {
      this._logger = compilation.getLogger("CopyExternalsPlugin");
      compilation.hooks.buildModule.tap("CopyExternalsPlugin", (currentModule: Module) => {
        if (currentModule instanceof ExternalModule) {
          this._promises.push(this.handleModule(currentModule, compiler.outputPath, compilation));
        }
      });
    });

    compiler.hooks.afterEmit.tapPromise("CopyExternalsPlugin", async () => {
      await Promise.all(this._promises);
    });
  }

  public async handleModule(currentModule: ExternalModule, outputDir: string, compilation: Compilation) {
    const pkgName = this.pathToPackageName(currentModule.userRequest);
    if (pkgName === "electron" || this.isBuiltinModule(pkgName) || this._copiedPackages.has(pkgName))
      return;

    let packageJsonPath = "";
    try {
      packageJsonPath = require.resolve(`${pkgName}/package.json`, { paths: [compilation.moduleGraph.getIssuer(currentModule)?.context ?? ""] });
    } catch (error) {
      // Always _log_ missing externals as a warning and add it as a compilation warning.
      const warning = `Can't copy external package "${pkgName}" - it is not installed.`;
      this._logger?.warn(warning);
      // TODO: only warn if a required dependency, Module.reasons was removed in webpack@5, figure out how to determine what kind of dep it is
      compilation.warnings.push(new WebpackError(`${warning}\nTo fix this, either npm install ${pkgName} or wrap the import in a try/catch.`));
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
    this._logger?.log(`Copying ${getAppRelativePath(pathToPackage)} to ${getAppRelativePath(path.resolve(outDir, "node_modules"))}`);
    await fs.copy(pathToPackage, path.resolve(outDir, "node_modules", pkgName), { dereference: true });
  }

  private pathToPackageName(p: string) {
    const parts = p.replace(/^.*node_modules[\\\/]/, "").replace(externalPrefix, "").split(/[\\\/]/);
    return (parts[0].startsWith("@")) ? `${parts[0]}/${parts[1]}` : parts[0];
  }

  private isBuiltinModule(pkgName: string): boolean {
    if (builtinModules.includes(pkgName))
      return true;

    if (pkgName.startsWith("node:") && builtinModules.includes(pkgName.substring(5)))
      return true;

    return false;
  }
}
