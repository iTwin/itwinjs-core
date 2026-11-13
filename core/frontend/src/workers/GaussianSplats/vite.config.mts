/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import path from "node:path";
import { createWorkerConfig } from "../viteWorkerConfig.mts";

export default createWorkerConfig({
  emptyOutDir: false,
  entry: path.resolve(__dirname, "../../../lib/esm/workers/GaussianSplats/Worker.js"),
  outDir: path.resolve(__dirname, "../../../lib/public/scripts"),
  outputFileName: "gaussian-splats-worker.js",
});
