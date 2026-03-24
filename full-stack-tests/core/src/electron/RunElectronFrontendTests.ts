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

describe("Full-Stack Tests (Electron Renderer)", () => {
  it("should pass all Electron renderer tests (parallel shards)", async () => {
    const results = await runElectronTests({
      backendInitModule: path.resolve(process.cwd(), "lib/backend/backend"),
      setupFile: path.resolve(process.cwd(), "lib/frontend/vitest.setup.js"),
      testDir: path.resolve(process.cwd(), "lib/frontend"),
      envFile: path.resolve(process.cwd(), ".env"),
      grepPattern,
      invertGrep,
      env: {
        IMODELJS_CORE_DIRNAME: path.resolve(process.cwd(), "../.."),
      },
    });

    if (results.failed > 0) {
      const summary = results.failedShards.map((i) => `shard-${i}`).join(", ");
      assert.fail(`${results.failed}/${results.shardCount} shards failed: ${summary} — check output above`);
    }
  }, 1_200_000);
});
