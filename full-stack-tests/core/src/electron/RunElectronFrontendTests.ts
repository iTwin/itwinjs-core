/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Vitest wrapper: delegates to the plugin's Electron test orchestrator.
// See @itwin/vitest-certa-bridge/electron for the full sharding/session implementation.

import { assert, describe, it } from "vitest";
import { runElectronTests } from "@itwin/vitest-certa-bridge/electron";
import * as path from "path";

// By default, exclude cloud/auth-dependent integration and performance tests.
// Override by setting VITEST_ELECTRON_GREP and VITEST_ELECTRON_INVERT=false.
const DEFAULT_EXCLUDE = "#integration|#performance";
const grepPattern = process.env.VITEST_ELECTRON_GREP ?? DEFAULT_EXCLUDE;
const invertGrep = process.env.VITEST_ELECTRON_INVERT !== undefined
  ? process.env.VITEST_ELECTRON_INVERT === "true"
  : true; // default: invert (exclude matching)

// CI hosted agents have limited GPU resources; 4 parallel Electron shards
// with WebGL contexts cause GPU starvation — rendering tests like PlanarClipMask
// time out waiting for tiles. Use 2 shards everywhere to halve GPU contention
// while preserving parallelism.
const shardCount = 2;

// When running integration tests (grep="#integration", invert=false), rendering
// tests like PlanarClipMask need more time under CI SwiftShader. Default 240s
// is too tight — tiles decode on main thread (no web worker in Electron).
const isIntegration = grepPattern === "#integration" && !invertGrep;
const testTimeout = isIntegration ? 480_000 : undefined;
// Session timeout must exceed the sum of all test timeouts in a shard.
// With 480s per-test and multiple rendering tests, 600s (default) isn't enough.
const sessionTimeout = isIntegration ? 1_200_000 : undefined;

describe("Full-Stack Tests (Electron Renderer)", () => {
  it("should pass all Electron renderer tests (parallel shards)", async () => {
    const results = await runElectronTests({
      backendInitModule: path.resolve(process.cwd(), "lib/backend/backend"),
      setupFile: path.resolve(process.cwd(), "lib/frontend/vitest.setup.js"),
      testDir: path.resolve(process.cwd(), "lib/frontend"),
      envFile: path.resolve(process.cwd(), ".env"),
      shardCount,
      grepPattern,
      invertGrep,
      testTimeout,
      timeout: sessionTimeout,
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
      assert.fail(lines.join("\n"));
    }
  }, 1_200_000);
});
