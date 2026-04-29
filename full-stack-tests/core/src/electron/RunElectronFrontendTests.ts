/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Vitest wrapper: delegates to the plugin's Electron test orchestrator.
// See @itwin/vitest-certa-bridge/electron for the full sharding/session implementation.

import { describe, it } from "vitest";
import { type GrepMode, runElectronTests } from "@itwin/vitest-certa-bridge/electron";
import * as path from "path";

// By default, exclude cloud/auth-dependent integration and performance tests.
// Override by setting VITEST_ELECTRON_GREP and VITEST_ELECTRON_INVERT=false.
const DEFAULT_EXCLUDE = "#integration|#performance";
const grepPattern = process.env.VITEST_ELECTRON_GREP ?? DEFAULT_EXCLUDE;
const grepMode = (process.env.VITEST_ELECTRON_INVERT !== undefined
  ? process.env.VITEST_ELECTRON_INVERT === "false" ? "include" : "exclude"
  : "exclude") as GrepMode;

// Shard count policy:
//   linux CI:    2 shards — software GL (SwiftShader) handles concurrent contexts.
//   windows CI:  2 shards — --disable-gpu is set below (see ciElectronArgs), so the
//                historical GPU-contention concern is moot. 2 shards halves the
//                per-process memory pressure that triggers STATUS_STACK_BUFFER_OVERRUN
//                (0xC0000409 fast-fail) on long sequential runs with the iTwin native addon.
//   darwin CI / local:  1 shard — real GPU, cannot --disable-gpu without breaking WebGL tests.
const isCIForSharding = !!(process.env.CI || process.env.TF_BUILD || process.env.AGENT_ID);
const shardCount = process.env.VITEST_ELECTRON_SHARD_COUNT
  ? Number(process.env.VITEST_ELECTRON_SHARD_COUNT)
  : process.platform === "linux" ? 2
    : (process.platform === "win32" && isCIForSharding) ? 2
      : 1;

// When running integration tests (grep="#integration", invert=false), rendering
// tests like PlanarClipMask need more time under CI SwiftShader. Default 240s
// is too tight — tiles decode on main thread (no web worker in Electron).
const isIntegration = grepPattern === "#integration" && grepMode === "include";
const testTimeout = isIntegration ? 480_000 : undefined;
// Session timeout must exceed the sum of all test timeouts in a shard.
// With 480s per-test and multiple rendering tests, 600s (default) isn't enough.
const sessionTimeout = isIntegration ? 1_200_000 : undefined;

// iTwin.js-specific renderer setup: patches TestUtility.startFrontend/shutdownFrontend
// to use require() instead of dynamic import() for @itwin/core-electron. In the Electron
// renderer, bare-specifier import() goes through Chromium's ESM loader which cannot resolve
// Node.js paths. This patch runs after test files are loaded and require.cache is populated.
const itwinRendererSetup = `
const allModules = Object.keys(require.cache);
const testUtilPath = allModules.find(m => m.endsWith("TestUtility.js") && m.includes("frontend"));
if (testUtilPath) {
  const TestUtility = require.cache[testUtilPath].exports.TestUtility;
  if (TestUtility) {
    if (TestUtility.startFrontend) {
      TestUtility.startFrontend = async function(opts, mockRender, enableWebEdit) {
        const iopts = { ...TestUtility.iModelAppOptions, ...opts };
        if (mockRender) iopts.renderSys = TestUtility.systemFactory();
        const processDetector = require("@itwin/core-bentley").ProcessDetector;
        if (processDetector.isElectronAppFrontend) {
          if (iopts.tileAdmin) iopts.tileAdmin.decodeImdlInWorker = false;
          else iopts.tileAdmin = { decodeImdlInWorker: false };
          const { ElectronApp } = require("@itwin/core-electron/lib/cjs/ElectronFrontend.js");
          return ElectronApp.startup({ iModelApp: iopts });
        }
        const { IModelApp, LocalhostIpcApp } = require("@itwin/core-frontend");
        if (enableWebEdit) {
          const socketUrl = new URL("ws://" + window.location.hostname + ":" + window.location.port + "/ipc");
          return LocalhostIpcApp.startup({ iModelApp: iopts, localhostIpcApp: { socketUrl } });
        }
        return IModelApp.startup(iopts);
      };
    }
    if (TestUtility.shutdownFrontend) {
      TestUtility.shutdownFrontend = async function() {
        TestUtility.systemFactory = () => TestUtility.createDefaultRenderSystem();
        const processDetector = require("@itwin/core-bentley").ProcessDetector;
        if (processDetector.isElectronAppFrontend) {
          const { ElectronApp } = require("@itwin/core-electron/lib/cjs/ElectronFrontend.js");
          return ElectronApp.shutdown();
        }
        return require("@itwin/core-frontend").IModelApp.shutdown();
      };
    }
  }
}
`;

describe("Full-Stack Tests (Electron Renderer)", () => {
  it("should pass all Electron renderer tests (parallel shards)", async () => {
    // On CI, disable GPU compositing for Linux/Windows. CI machines use software
    // renderers (SwiftShader on Linux, WARP on Windows) — parallel Electron shards
    // racing for GPU resources cause transient CreateCommandBuffer failures.
    // macOS CI has real GPUs; --disable-gpu would break WebGL there.
    const isCI = !!(process.env.CI || process.env.TF_BUILD || process.env.AGENT_ID);
    const ciElectronArgs = isCI && process.platform !== "darwin" ? ["--disable-gpu"] : [];

    const results = await runElectronTests({
      backendInitModule: path.resolve(process.cwd(), "lib/backend/backend"),
      setupFile: path.resolve(process.cwd(), "lib/frontend/vitest.setup.js"),
      testDir: path.resolve(process.cwd(), "lib/frontend"),
      envFile: path.resolve(process.cwd(), ".env"),
      shardCount,
      grepPattern,
      grepMode,
      testTimeout,
      timeout: sessionTimeout,
      importRewritePatterns: ["@itwin/core-electron/[^\"']+"],
      rendererSetup: itwinRendererSetup,
      electronArgs: ciElectronArgs,
      env: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        IMODELJS_CORE_DIRNAME: path.resolve(process.cwd(), "../.."),
      },
    });

    if (results.failed > 0) {
      const lines = [`${results.failed} test(s) failed across ${results.failedShards.length} shard(s)`];
      if (results.skipped > 0)
        lines[0] += `, ${results.skipped} skipped (timeout cascade abort)`;
      lines[0] += ":\n";
      for (const sr of results.shardResults) {
        if (sr.errors.length === 0 && sr.skipped === 0)
          continue;
        const skipped = sr.skipped > 0 ? `, ${sr.skipped} skipped` : "";
        lines.push(`  shard-${sr.shardIndex} (${sr.fileCount} files, ${(sr.durationMs / 1000).toFixed(1)}s${skipped}):`);
        for (const err of sr.errors)
          lines.push(`    ✗ ${err}`);
      }
      const error = new Error(lines.join("\n"));
      error.stack = error.message;
      throw error;
    }
  }, 1_200_000);
});
