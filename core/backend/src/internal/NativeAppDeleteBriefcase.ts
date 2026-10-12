/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "node:path";
import { IModelStatus, OpenMode } from "@itwin/core-bentley";
import { IModelError, LocalFileName } from "@itwin/core-common";
import { BriefcaseManager } from "../BriefcaseManager";
import { IModelDb } from "../IModelDb";
import { IModelJsFs } from "../IModelJsFs";

function isInBriefcaseCache(resolvedPath: string): boolean {
  const cacheDir = BriefcaseManager.cacheDir;
  if (!cacheDir)
    return false;

  const cacheRoot = path.resolve(cacheDir) + path.sep;
  return process.platform === "win32"
    ? resolvedPath.toLowerCase().startsWith(cacheRoot.toLowerCase())
    : resolvedPath.startsWith(cacheRoot);
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
 * @returns the resolved path to delete, or `undefined` if there is nothing to delete (the file does not exist and is outside the briefcase cache).
 * @throws [IModelError]($common) with [IModelStatus.BadRequest]($bentley) if the file exists but is neither a valid iModel nor in the briefcase cache.
 * @internal
 */
export function checkFrontendBriefcaseDelete(filePath: LocalFileName): LocalFileName | undefined {
  const resolvedPath = path.resolve(filePath);
  if (isInBriefcaseCache(resolvedPath))
    return resolvedPath;

  // Don't pass a missing file outside the cache along, since deleteBriefcaseFiles would still delete its associated files.
  if (!IModelJsFs.existsSync(resolvedPath))
    return undefined;

  if (!isValidIModel(resolvedPath))
    throw new IModelError(IModelStatus.BadRequest, `cannot delete "${filePath}": it is not a valid iModel and is not in the briefcase cache`);

  return resolvedPath;
}
