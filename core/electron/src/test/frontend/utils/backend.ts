/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ElectronHost } from "../../../ElectronBackend";

async function init() {
  const cacheDir = process.env.VITEST_ELECTRON_CACHE_DIR ?? process.env.ELECTRON_CACHE_DIR;
  await ElectronHost.startup(cacheDir ? {
    iModelHost: {
      cacheDir,
      profileName: `renderer-${process.pid}`,
    },
  } : undefined);
}

module.exports = init();
