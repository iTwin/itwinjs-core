/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// this is the nodejs-specific implementation of the IModelJsFs pseudo-interface.
// On mobile platforms, this file is not included. Instead, the iModelJs host app implements IModelJsFs in native code and projects it into JavaScript.

/** @module Portability */

import * as fs from "fs-extra";

/** Information about a file. See [[IModelJsFs.lstatSync]]
 * TODO: define File Mode Constants: S_IWUSR, et al.
 */
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
  public static existsSync(fn: string): boolean { return fs.existsSync(fn); }

  /** Delete a file. */
  public static unlinkSync(fn: string): void { fs.unlinkSync(fn); }

  /** Delete a file or remove a directory (rm -r). */
  public static removeSync(fn: string): void { fs.removeSync(fn); }

  /** Create a directory. */
  public static mkdirSync(fn: string): void { fs.mkdirSync(fn); }

  /** Remove a directory. */
  public static rmdirSync(fn: string): void { fs.rmdirSync(fn); }

  /** Write to a file. */
  public static writeFileSync(fn: string, str: string, wflag: string = "w"): void { fs.writeFileSync(fn, str, { flag: wflag }); }

  /** Make a copy of a file */
  public static copySync(fn: string, fnout: string, opts?: any): void { fs.copySync(fn, fnout, opts); }

  /** Get the file and directory names in the specified directory. Excludes "." and "..". */
  public static readdirSync(fn: string): string[] { return fs.readdirSync(fn); }

  /** Read file */
  public static readFileSync(fn: string): string|Buffer { return fs.readFileSync(fn); }

  /** Test if the current user has permission to write to a file. */
  private static isFileWritable(fn: string): boolean {
    try {
      fs.accessSync(fn, fs.constants.W_OK);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /** Get information about a file. */
  public static lstatSync(fn: string): IModelJsFsStats | undefined {
    const stats = fs.lstatSync(fn);
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
      !IModelJsFs.isFileWritable(fn));
  }

}
