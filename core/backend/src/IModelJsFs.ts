/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
// this is the nodejs-specific implementation of the IModelJsFs pseudo-interface.
// On mobile platforms, this file is not included. Instead, the iModel.js host app implements IModelJsFs in native code and projects it into JavaScript.

/** @module Portability */

import * as fs from "fs-extra";

/* TODO: define File Mode Constants: S_IWUSR, et al. */
/** Information about a file. See [[IModelJsFs.lstatSync]] */
export class IModelJsFsStats {
  constructor(
    public size: number,
    public atimeMs: number,
    public mtimeMs: number,
    public birthtimeMs: number,
    public isDirectory: boolean,
    public isFile: boolean,
    public isSocket: boolean,
    public isSymbolicLink: boolean,
    public isReadOnly: boolean,
  ) { }
}

/** File system operations that are defined on all platforms. See also [[Platform]] and [[KnownLocations]] */
export class IModelJsFs {

  /** Does file or directory exist? */
  public static existsSync(path: string): boolean { return fs.existsSync(path); }

  /** Delete a file. */
  public static unlinkSync(path: string): void { fs.unlinkSync(path); }

  /** Delete a file or remove a directory (rm -r). */
  public static removeSync(path: string): void { fs.removeSync(path); }

  /** Create a directory. */
  public static mkdirSync(path: string): void { fs.mkdirSync(path); }

  /** Remove a directory. */
  public static rmdirSync(path: string): void { fs.rmdirSync(path); }

  /** Write to a file. */
  public static writeFileSync(path: string, str: string, wflag: string = "w"): void { fs.writeFileSync(path, str, { flag: wflag }); }

  /** Append to a file. */
  public static appendFileSync(path: string, str: string): void { fs.appendFileSync(path, str); }

  /** Make a copy of a file */
  public static copySync(src: string, dest: string, opts?: any): void { fs.copySync(src, dest, opts); }

  /** Get the file and directory names in the specified directory. Excludes "." and "..". */
  public static readdirSync(path: string): string[] { return fs.readdirSync(path); }

  /** Read file */
  public static readFileSync(path: string): string | Buffer { return fs.readFileSync(path); }

  /** Test if the current user has permission to write to a file. */
  private static isFileWritable(path: string): boolean {
    try {
      fs.accessSync(path, fs.constants.W_OK);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /** Get information about a file. */
  public static lstatSync(path: string): IModelJsFsStats | undefined {
    const stats = fs.lstatSync(path);
    if (stats === undefined)
      return undefined;

    return new IModelJsFsStats(
      stats.size,
      stats.atime.getTime(),
      stats.mtime.getTime(),
      stats.birthtime.getTime(),
      stats.isDirectory(),
      stats.isFile(),
      stats.isSocket(),
      stats.isSymbolicLink(),
      !IModelJsFs.isFileWritable(path));
  }

}
