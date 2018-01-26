/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
// this is the nodejs-specific implementation of the IModelJsFs pseudo-interface.
// On mobile platforms, this file is not included, and the platform implements and projects IModelJsFs.

import * as fs from "fs-extra";

/** Information about a file */
export class IModelJsFsStats {
  public size: number;
  public atimeMs: number;
  public mtimeMs: number;
  public birthtimeMs: number;
  public isDirectory: boolean;
  public isFile: boolean;
  public isSocket: boolean;
  public isSymbolicLink: boolean;
  public isReadOnly: boolean;
}

/** File system operations */
export class IModelJsFs {

  /** Does file or directory exist? */
  public static existsSync(fn: string): boolean {
    return fs.existsSync(fn);
  }

  /** Delete a file. */
  public static unlinkSync(fn: string): void {
    fs.unlinkSync(fn);
  }

  /** Delete a file or remove a directory (rm -r). */
  public static removeSync(fn: string): void {
    fs.removeSync(fn);
  }

  /** Create a directory. */
  public static mkdirSync(fn: string): void {
    fs.mkdirSync(fn);
  }

  /** Remove a directory. */
  public static rmdirSync(fn: string): void {
    fs.rmdirSync(fn);
  }

  /** Write to a file. */
  public static writeFileSync(fn: string, str: string, wflag: string = "w"): void {
    fs.writeFileSync(fn, str, { flag: wflag } );
  }

  /** Make a copy of a file */
  public static copySync(fn: string, fnout: string, opts?: any): void {
    fs.copySync(fn, fnout, opts);
  }

  /** Get the file and directory names in the specified directory. Excludes "." and "..". */
  public static readdirSync(fn: string): string[] {
    return fs.readdirSync(fn);
  }

  /** Get information about a file. */
  public static lstatSync(fn: string): IModelJsFsStats | undefined {
    const stats = fs.statSync(fn);
    if (stats === undefined)
      return undefined;

    const st = new IModelJsFsStats();
    st.size = stats.size;
    st.atimeMs = stats.atime.getTime();
    st.mtimeMs = stats.mtime.getTime();
    st.birthtimeMs = stats.birthtime.getTime();
    st.isDirectory = stats.isDirectory();
    st.isFile = stats.isFile();
    st.isSocket = stats.isSocket();
    st.isSymbolicLink = stats.isSymbolicLink();
    return st;
  }

}
