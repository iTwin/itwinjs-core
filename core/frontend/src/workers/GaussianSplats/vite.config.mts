/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import path from "node:path";
import { createWorkerConfig } from "../viteWorkerConfig.mts";

const config = createWorkerConfig({
  emptyOutDir: false,
  entry: path.resolve(__dirname, "../../../lib/esm/workers/GaussianSplats/Worker.js"),
  outDir: path.resolve(__dirname, "../../../lib/public/scripts"),
  outputFileName: "gaussian-splats-worker.js",
});

export default {
  ...config,
  define: {
    ...config.define,
    // Emscripten's import.meta.url otherwise becomes a document.currentScript reference in an IIFE.
    "import.meta.url": "self.location.href",
    "globalThis.process": "undefined",
  },
};
