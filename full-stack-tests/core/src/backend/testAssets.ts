/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";

/** The core-backend test assets that tests may copy through test IPC. */
export const backendTestAssetsDir = path.join(__dirname, "../../../../core/backend/src/test/assets");

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== "" && relative.split(path.sep)[0] !== ".." && !path.isAbsolute(relative);
}

/** Resolve `sourcePath`, and throw unless it names a file inside `assetsDir`.
 * The test IPC socket has no authentication, so it must not copy arbitrary files.
 * The path is checked before and after resolving symlinks, so a rejected path doesn't reveal whether a file exists.
 */
export function resolveTestAssetPath(sourcePath: string, assetsDir: string = backendTestAssetsDir): string {
  const reject = () => new Error(`Only files in ${assetsDir} can be copied; got ${sourcePath}.`);
  if (!isInside(path.resolve(assetsDir), path.resolve(sourcePath)))
    throw reject();
  const resolved = fs.realpathSync(sourcePath);
  if (!isInside(fs.realpathSync(assetsDir), resolved))
    throw reject();
  return resolved;
}
