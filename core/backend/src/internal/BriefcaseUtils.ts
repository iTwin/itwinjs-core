/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { IModelStatus, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalDirName, LocalFileName } from "@itwin/core-common";
import { IModelDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";

/**
 * Determine whether `fileName` is a file associated with the briefcase named `briefcaseName`. That is, whether it is named
 * `<briefcaseName>-*` or `<briefcaseName>.*` (e.g. "a.bim-wal", "a.bim-locks", "a.bim.Tiles", "a.bim.HierarchyCache.db").
 * Several native modules create their own files alongside a briefcase, so this is a naming rule rather than a fixed list.
 * @internal
 */
export function isBriefcaseSidecar(fileName: string, briefcaseName: string): boolean {
  if (process.platform === "win32") {
    fileName = fileName.toLowerCase();
    briefcaseName = briefcaseName.toLowerCase();
  }
  const separator = fileName[briefcaseName.length];
  return fileName.length > briefcaseName.length + 1 && fileName.startsWith(briefcaseName) && (separator === "-" || separator === ".");
}

function isInDirectory(resolvedPath: string, dir: LocalDirName | undefined): boolean {
  if (!dir)
    return false;

  const root = path.resolve(dir) + path.sep;
  return process.platform === "win32"
    ? resolvedPath.toLowerCase().startsWith(root.toLowerCase())
    : resolvedPath.startsWith(root);
}

function isValidIModel(resolvedPath: string): boolean {
  try {
    IModelDb.openDgnDb({ path: resolvedPath }, OpenMode.Readonly).closeFile();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check a briefcase path received from the frontend (via [NativeApp.deleteBriefcase]($frontend)) before it is passed to
 * [[BriefcaseManager.deleteBriefcaseFiles]]. The frontend may only delete files that are inside the briefcase cache, or that are valid iModels.
 * @param filePath the path supplied by the frontend.
 * @param cacheDir the briefcase cache directory (see [[BriefcaseManager.cacheDir]]).
 * @returns the resolved path to delete, or `undefined` if there is nothing to delete (the file does not exist and is outside the briefcase cache).
 * @throws [IModelError]($common) with [IModelStatus.BadRequest]($bentley) if the file exists but is neither a valid iModel nor in the briefcase cache.
 * @internal
 */
export function checkFrontendBriefcaseDelete(filePath: LocalFileName, cacheDir: LocalDirName | undefined): LocalFileName | undefined {
  const resolvedPath = path.resolve(filePath);
  if (isInDirectory(resolvedPath, cacheDir))
    return resolvedPath;

  // Don't pass a missing file outside the cache along, since deleteBriefcaseFiles would still delete its associated files.
  if (!IModelJsFs.existsSync(resolvedPath))
    return undefined;

  if (!isValidIModel(resolvedPath))
    throw new IModelError(IModelStatus.BadRequest, `cannot delete "${filePath}": it is not a valid iModel and is not in the briefcase cache`);

  return resolvedPath;
}
