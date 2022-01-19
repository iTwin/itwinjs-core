/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Portability
 */

// cspell: ignore wflag

import * as fs from "fs-extra";
import * as path from "path";

/* TODO: define File Mode Constants: S_IWUSR, et al. */
/** Information about a file. See [[IModelJsFs.lstatSync]]
 * @public
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

/** File system operations that are defined on all platforms. See also [[Platform]] and [[KnownLocations]]
 * @public
 */
export class IModelJsFs {

  /** Does file or directory exist? */
  public static existsSync(pathname: string): boolean { return fs.existsSync(pathname); }

  /** Delete a file. */
  public static unlinkSync(pathname: string): void { fs.unlinkSync(pathname); }

  /** Delete a file or remove a directory (rm -r). */
  public static removeSync(pathname: string): void { fs.removeSync(pathname); }

  /** Create a directory. */
  public static mkdirSync(pathname: string): void { fs.mkdirSync(pathname); }

  /** Remove a directory. */
  public static rmdirSync(pathname: string): void { fs.rmdirSync(pathname); }

  /** Write to a file. */
  public static writeFileSync(pathname: string, data: string | Uint8Array, wflag: string = "w"): void { fs.writeFileSync(pathname, data, { flag: wflag }); }

  /** Append to a file. */
  public static appendFileSync(pathname: string, str: string): void { fs.appendFileSync(pathname, str); }

  /** Make a copy of a file */
  public static copySync(src: string, dest: string, opts?: any): void { fs.copySync(src, dest, opts); }

  /** Get the file and directory names in the specified directory. Excludes "." and "..". */
  public static readdirSync(pathname: string): string[] { return fs.readdirSync(pathname); }

  /** Read file */
  public static readFileSync(pathname: string): string | Buffer { return fs.readFileSync(pathname); }

  /** Test if the current user has permission to write to a file. */
  private static isFileWritable(pathname: string): boolean {
    try {
      fs.accessSync(pathname, fs.constants.W_OK);
      return true;
    } catch (_err) {
      return false;
    }
  }

  /** Get information about a file. */
  public static lstatSync(pathname: string): IModelJsFsStats | undefined {
    const stats = fs.lstatSync(pathname);
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
      !IModelJsFs.isFileWritable(pathname));
  }

  /**
   * Finds files recursively based on a pattern
   * @param rootDir Directory from where to start searching for files.
   * @param pattern A Regex that would be match to basename of files including extension
   * @returns list of file that match the pattern.
   */
  public static recursiveFindSync(rootDir: string, pattern: RegExp): string[] {
    const files: string[] = [];
    IModelJsFs.walkDirSync(rootDir, (pathname: string, isDir: boolean) => {
      if (!isDir) {
        const fileName = path.basename(pathname);
        if (pattern.test(fileName)) {
          files.push(pathname);
        }
      }
      return true;
    });
    return files;
  }

  /**
   * Walks a directory in breadth first fashion
   * @param rootDir  directory from where the traversal starts
   * @param cb callback that would be called with full path of file or directory
   */
  public static walkDirSync(rootDir: string, cb: (pathname: string, isDir: boolean) => boolean): void {
    const subDir = [];
    for (const childPath of IModelJsFs.readdirSync(rootDir)) {
      const fullPath = path.join(rootDir, childPath);
      const isDir = IModelJsFs.lstatSync(fullPath)?.isDirectory;
      if (!cb(fullPath, isDir ?? false)) {
        return;
      }
      // Need to check if the directory still exists in case the callback has deleted it.
      if (isDir && IModelJsFs.existsSync(fullPath)) {
        subDir.push(fullPath);
      }
    }
    subDir.forEach((v) => {
      IModelJsFs.walkDirSync(v, cb);
    });
  }

  /** Create a directory, recursively setting up the path as necessary */
  public static recursiveMkDirSync(dirPath: string) {
    if (IModelJsFs.existsSync(dirPath))
      return;
    const parentPath = path.dirname(dirPath);
    if (parentPath !== dirPath)
      IModelJsFs.recursiveMkDirSync(parentPath);
    IModelJsFs.mkdirSync(dirPath);
  }

  /** Remove a directory, recursively */
  public static purgeDirSync(dirPath: string) {
    if (!IModelJsFs.existsSync(dirPath))
      return;

    IModelJsFs.walkDirSync(dirPath, (pathName: string, isDir: boolean) => {
      if (isDir) {
        IModelJsFs.purgeDirSync(pathName);
        IModelJsFs.removeSync(pathName);
      } else {
        IModelJsFs.unlinkSync(pathName);
      }
      return true;
    });
  }
}
