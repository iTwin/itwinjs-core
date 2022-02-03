/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import type { Compiler } from "webpack";
import { getPaths, resolveApp } from "../utils/paths";
/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const CopyPlugin = require("copy-webpack-plugin");
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */

abstract class AbstractAsyncStartupPlugin {
  private _name: string;
  private _promise!: Promise<any>;
  public logger: any;

  constructor(name: string) {
    this._name = name;
  }

  public apply(compiler: Compiler) {
    compiler.hooks.beforeRun.tap(this._name, () => {
      this._promise = this.runAsync(compiler);
    });

    compiler.hooks.compilation.tap(this._name, (compilation) => {
      this.logger = compilation.getLogger(this._name);
    });

    compiler.hooks.afterEmit.tapPromise(this._name, async () => {
      await this._promise;
    });
  }

  public abstract runAsync(compiler: Compiler): Promise<any>;
}

async function isDirectory(directoryName: string) {
  return (await fs.stat(directoryName)).isDirectory();
}

async function tryCopyDirectoryContents(source: string, target: string) {
  if (!fs.existsSync(source))
    return;

  const copyOptions = { dereference: true, preserveTimestamps: true, overwrite: false, errorOnExist: false };
  try {
    if (await isDirectory(source) && fs.existsSync(target) && await isDirectory(target)) {
      for (const name of await fs.readdir(source)) {
        await tryCopyDirectoryContents(path.join(source, name), path.join(target, name));
      }
    } else {
      await fs.copy(source, target, copyOptions);
    }
  } catch (err: any) {
    console.log(`Error trying to copy '${source}' to '${target}': ${err.toString()}`);
  }
}

/** Prefer use of CopyStaticAssetsPlugin instead when outside monorepos. */
export class CopyBentleyStaticResourcesPlugin extends AbstractAsyncStartupPlugin {
  private _directoryNames: string[];
  private _useDirectoryName: boolean;

  constructor(directoryNames: string[], useDirectoryName?: boolean) {
    super("CopyBentleyStaticResourcesPlugin");
    this._directoryNames = directoryNames;
    this._useDirectoryName = undefined === useDirectoryName ? false : useDirectoryName;
  }

  public async runAsync(compiler: Compiler) {
    const paths = getPaths();

    const copyContents = async (basePath: string) => {
      let subDirectoryNames: string[];
      try {
        subDirectoryNames = await fs.readdir(basePath);
      } catch (err: any) {
        return;
      }
      for (const thisSubDir of subDirectoryNames) {
        if (!(await isDirectory(path.resolve(basePath, thisSubDir))))
          continue;

        const fullDirName = path.resolve(basePath, thisSubDir);
        for (const staticAssetsDirectoryName of this._directoryNames) {
          await tryCopyDirectoryContents(
            path.join(fullDirName, "lib", staticAssetsDirectoryName),
            this._useDirectoryName ? compiler.outputPath : path.join(compiler.outputPath, staticAssetsDirectoryName),
          );
        }
      }
    };

    const bentleyDir = path.resolve(paths.appNodeModules, "@bentley");
    const itwinDir = path.resolve(paths.appNodeModules, "@itwin");

    await copyContents(bentleyDir);
    await copyContents(itwinDir);

    return;
  }
}

export class CopyAppAssetsPlugin extends AbstractAsyncStartupPlugin {
  constructor(private _assetsDir: string = "assets") {
    super("CopyAppAssetsPlugin");
  }

  public async runAsync(compiler: Compiler) {
    const outAssetsDir = path.resolve(compiler.outputPath, "assets");
    await tryCopyDirectoryContents(resolveApp(this._assetsDir), outAssetsDir);
  }
}

export class CopyStaticAssetsPlugin {
  private _scopes: string[];
  private _fromTo: string;
  private _useDirectoryName: boolean;

  constructor({
    scopes = ["@bentley", "@itwin"],
    fromTo = "public",
    useDirectoryName = false,
  }) {
    this._scopes = scopes;
    this._fromTo = fromTo;
    this._useDirectoryName = useDirectoryName;
  }

  private _getPatterns() {
    if (!this._scopes || !this._fromTo) {
      return [];
    }

    const fromTo = this._fromTo;
    const useDirectoryName = this._useDirectoryName;

    return this._scopes.map((scope) => {
      return {
        from: `**/${fromTo}/**/*`,
        context: `node_modules/${scope}`,
        noErrorOnMissing: true,
        to({ absoluteFilename }: { absoluteFilename: string }) {
          const regex = new RegExp(`(${fromTo}(?:\\\\|\/))(.*)`);
          return regex.exec(absoluteFilename)![useDirectoryName ? 0 : 2];
        },
      };
    });
  }

  public apply(compiler: Compiler) {
    const patterns = this._getPatterns();
    new CopyPlugin({ patterns }).apply(compiler);
  }
}
