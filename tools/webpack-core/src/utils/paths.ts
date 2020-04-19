/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as fs from "fs";
import * as path from "path";

const appDirectory = fs.realpathSync(process.cwd());
export const resolveApp = (relativePath: string) => path.resolve(appDirectory, relativePath);

export const paths = {
  // Top-level files
  appPackageJson: resolveApp("package.json"),
  appNodeModules: resolveApp("node_modules"),
};
