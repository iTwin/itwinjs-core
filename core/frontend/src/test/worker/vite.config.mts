/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import path from "node:path";
import { createWorkerConfig } from "../../workers/viteWorkerConfig.mts";

const frontendLib = path.resolve(__dirname, "../../../lib");
const coreGeometryRoot = path.resolve(frontendLib, "../../geometry").replaceAll("\\", "/");

export default createWorkerConfig({
  entry: path.resolve(frontendLib, "esm/test/worker/test-worker.js"),
  moduleSideEffects: (id) => {
    // Path and Loop extend CurveChain and must not be reordered ahead of its module initialization.
    return id.replaceAll("\\", "/").startsWith(`${coreGeometryRoot}/`);
  },
  outDir: path.resolve(frontendLib, "test"),
  outputFileName: "test-worker.js",
});
