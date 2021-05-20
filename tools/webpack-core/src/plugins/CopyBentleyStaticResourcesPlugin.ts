/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs-extra";
import * as path from "path";
import { Compiler } from "webpack";
import { paths, resolveApp } from "../utils/paths";

/* eslint-disable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
const CopyPlugin = require('copy-webpack-plugin');
/* eslint-enable @typescript-eslint/no-var-requires, @typescript-eslint/naming-convention */
abstract class AbstractAsyncStartupPlugin {
  private _name: string;
  private _promise!: Promise<any>;

  constructor(name: string) {
    this._name = name;
  }

  public apply(compiler: Compiler) {
    compiler.hooks.beforeRun.tap(this._name, () => {
      this._promise = this.runAsync(compiler);
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
  } catch (err) {
    console.log(`Error trying to copy '${source}' to '${target}': ${err.toString()}`);
  }
}

export class CopyBentleyStaticResourcesPlugin extends AbstractAsyncStartupPlugin {
  private _directoryNames: string[];
  private _useDirectoryName: boolean;

  constructor(directoryNames: string[], useDirectoryName?: boolean) {
    super("CopyBentleyStaticResourcesPlugin");
    this._directoryNames = directoryNames;
    this._useDirectoryName = undefined === useDirectoryName ? false : useDirectoryName;
  }

  public async runAsync(compiler: Compiler) {
    const bentleyDir = path.resolve(paths.appNodeModules, "@bentley");
    const subDirectoryNames = await fs.readdir(bentleyDir);
    for (const thisSubDir of subDirectoryNames) {
      if (!(await isDirectory(path.resolve(bentleyDir, thisSubDir))))
        continue;

      const fullDirName = path.resolve(bentleyDir, thisSubDir);
      for (const staticAssetsDirectoryName of this._directoryNames) {
        await tryCopyDirectoryContents(
          path.join(fullDirName, "lib", staticAssetsDirectoryName),
          this._useDirectoryName ? compiler.outputPath : path.join(compiler.outputPath, staticAssetsDirectoryName),
        );
      }
    }
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

export class CopyStaticAssetsPlugin extends AbstractAsyncStartupPlugin {
  private _scopes: string[];
  private _shouldLocalizeI18n: boolean;
  private _fromTo: string;

  constructor({ scopes = ['@bentley', '@itwin'], shouldLocalizeI18n = false, fromTo = 'public' }) {
    super("CopyStaticAssetsPlugin");
    this._scopes = scopes;
    this._shouldLocalizeI18n = shouldLocalizeI18n;
    this._fromTo = fromTo;
  }

  private _pseudoLocalizeTransform(content: Buffer, absoluteFrom: string, fromTo: string) {
    const regex = new RegExp(`(${fromTo}\\\\locales\\\\en\\\\)(.*)(\.json)`)
    if (!regex.exec(absoluteFrom)) {
      return content;
    }

    const unlocalizedJson = JSON.parse(content.toString())
    const localizedJson = pseudoLocalizeObject(unlocalizedJson)
    const localizedStrings = JSON.stringify(localizedJson)
    return Buffer.from(localizedStrings)
  }


  private _getPatterns() {
    if (!this._scopes || !this._fromTo) {
      return [];
    }

    const patterns = []
    const fromTo = this._fromTo;
    const shouldLocalizeI18n = this._shouldLocalizeI18n;
    const pseudoLocalizeTransform = this._pseudoLocalizeTransform;

    for (const scope of this._scopes) {
      patterns.push({
        from: `**/${fromTo}/**/*`,
        context: `node_modules/${scope}`,
        noErrorOnMissing: true,
        to({ absoluteFilename }: { absoluteFilename: string }) {
          const regex = new RegExp(`(${fromTo}\\\\)(.*)`)
          return Promise.resolve(regex.exec(absoluteFilename)![2])},
        transform(content: Buffer, absoluteFrom: string) {
          return shouldLocalizeI18n ? pseudoLocalizeTransform(content, absoluteFrom, fromTo) : content;
        },
      })
    }
    return patterns;
  }

  public runAsync(_compiler: Compiler): Promise<any> {
    throw new Error("Method not implemented.");
  }

  // public async runAsync(compiler: Compiler) {
  public apply(compiler: Compiler) {
    console.log("running my custom plugin")
    const patterns = this._getPatterns()
    new CopyPlugin({ patterns }).apply(compiler)
  }
}

const replacements = {
  "A": "\u00C0\u00C1,\u00C2\u00C3,\u00C4\u00C5",
  "a": "\u00E0\u00E1\u00E2\u00E3\u00E4\u00E5",
  "B": "\u00DF",
  "c": "\u00A2\u00E7",
  "C": "\u00C7\u0028",
  "D": "\u00D0",
  "E": "\u00C8\u00C9\u00CA\u00CB",
  "e": "\u00E8\u00E9\u00EA\u00EB",
  "I": "\u00CC\u00CD\u00CE\u00CF",
  "i": "\u00EC\u00ED\u00EE\u00EF",
  "L": "\u00A3",
  "N": "\u00D1",
  "n": "\u00F1",
  "O": "\u00D2\u00D3\u00D4\u00D5\u00D6",
  "o": "\u00F2\u00F3\u00F4\u00F5\u00F6\u00F8",
  "S": "\u0024\u00A7",
  "U": "\u00D9\u00DA\u00DB\u00DC",
  "u": "\u00B5\u00F9\u00FA\u00FB\u00FC",
  "x": "\u00D7",
  "Y": "\u00DD\u00A5",
  "y": "\u00FD\u00FF",
};

/** PseudoLocalizes a single string */
function pseudoLocalize(inputString: string) {
  let inReplace = 0;
  let outString = "";
  let replaceIndex = 0; // Note: the pseudoLocalize algorithm would normally use random, but here we cycle through because Javascript doesn't allow setting of the seed for Math.random.
  for (let iChar = 0; iChar < inputString.length; iChar++) {
    let thisChar = inputString.charAt(iChar);
    let nextChar = ((iChar + 1) < inputString.length) ? inputString.charAt(iChar + 1) : 0;

    // handle the {{ and }} delimiters for placeholders - don't want to do anything to characters in between.
    if (('{' === thisChar) && ('{' === nextChar)) {
      inReplace++;
      iChar++;
      outString = outString.concat("{{");
    } else if (('}' === thisChar) && ('}' === nextChar) && (inReplace > 0)) {
      inReplace--;
      iChar++;
      outString = outString.concat("}}");
    } else {
      let replacementChar = thisChar;
      if (0 === inReplace) {
        let replacementsForChar = replacements[thisChar as keyof typeof replacements];
        if (undefined !== replacementsForChar) {
          replacementChar = replacementsForChar.charAt(replaceIndex++ % replacementsForChar.length);
        }
      }
      outString = outString.concat(replacementChar);
    }
  }
  return outString;
}

function pseudoLocalizeObject(objIn: any) {
  let objOut: any = {};
  for (let prop in objIn) {
    if (objIn.hasOwnProperty(prop)) {
      if (typeof objIn[prop] === "string") {
        objOut[prop] = pseudoLocalize(objIn[prop])
      } else if (typeof objIn[prop] === "object") {
        objOut[prop] = pseudoLocalizeObject(objIn[prop])
      }
    }
  }
  return objOut;
}