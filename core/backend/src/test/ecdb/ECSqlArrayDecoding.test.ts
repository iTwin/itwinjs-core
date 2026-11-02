/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert } from "chai";

describe("ECSql array decoding", () => {
  const cases: Array<[string, string[]]> = [
    ["decode a valid point array", []],
    // A REAL value where a JSON array is expected; the outcome depends on the value's bit pattern.
    ["reject a scalar that crashes the decoder", ["1234.5678"]],
    ["reject a scalar that makes the array iterator unbounded", ["0.1"]],
    ["reject a scalar that decodes as an empty array", ["1.5"]],
  ];
  for (const [title, args] of cases) {
    it(`should ${title}`, () => {
      const directory = mkdtempSync(join(tmpdir(), "ecsql-array-decoding-"));
      try {
        // Run in a child process so a native crash fails the test instead of terminating Mocha.
        const result = spawnSync(process.execPath, [join(__dirname, "ECSqlArrayDecodingWorker.js"), directory, ...args], {
          encoding: "utf8",
          timeout: 20_000,
        });
        const diagnostic = `error=${result.error?.message}, signal=${result.signal}, status=${result.status}\n${result.stdout}\n${result.stderr}`;
        assert.isUndefined(result.error, diagnostic);
        assert.isNull(result.signal, diagnostic);
        assert.equal(result.status, 0, diagnostic);
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    });
  }
});
