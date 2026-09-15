/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import path from "node:path";
import { createWorkerConfig } from "../viteWorkerConfig.mts";

const frontendLib = path.resolve(__dirname, "../../../lib");

export default createWorkerConfig({
  // copy:public runs first; retain the other scripts already copied into this shared directory.
  emptyOutDir: false,
  entry: path.resolve(frontendLib, "esm/workers/ImdlParser/Worker.js"),
  outDir: path.resolve(frontendLib, "public/scripts"),
  outputFileName: "parse-imdl-worker.js",
});
