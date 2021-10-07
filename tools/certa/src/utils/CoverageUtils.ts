/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import * as fs from "fs";
import * as path from "path";
import * as uuid from "uuid";
import { onExit, spawnChildProcess } from "./SpawnUtils";

/**
 * Helper function for relaunching (as a child process) the current process running under `nyc` for measuring code coverage.
 * Once that completes, a second `nyc` child process will be spawned to report the coverage results.
 * Returns a promise that will be resolved with either 0 or the first non-zero child process exit code, once the reporter process terminates.
 */
export async function relaunchForCoverage(): Promise<number> {
  const nyc = require.resolve("c8/bin/c8");
  const relaunchArgs = [
    nyc,
    "--config",
    path.join(process.cwd(), ".nycrc"),
    "--",
    ...process.argv,
  ];

  // By splitting "instrument/runTests" and "report coverage" into two steps, we allow test runners the option of
  // running separate (concurrent) instrumented processes that also write to `nyc`'s temp directory.
  const instrumentedProcess = spawnChildProcess("node", relaunchArgs, { ...process.env, NYC_CWD: process.cwd() }, false, path.join(process.cwd(), "../.."));
  return await onExit(instrumentedProcess);
}

/**
 * Writes nyc or istanbul-generated coverage data to a uniquely-named file inside `nyc`'s temp directory.
 * All such files in the nyc temp directory are merged together when nyc reports are generated via `nyc report`.
 * @param coverageData The value of an nyc/istanbul-generated `__coverage__` object.
 */
export function writeCoverageData(coverageData: any): void {
  const nycTempDirAbsolute = process.env.NODE_V8_COVERAGE!;
  if (!fs.existsSync(nycTempDirAbsolute))
    throw new Error(`Cannot save coverage data - nyc temp directory "${nycTempDirAbsolute}" does not exist.`);

  // Use uuid/v4 to generate a unique filename, just like `nyc` does.
  const coverageFileName = path.join(nycTempDirAbsolute, `${uuid.v4()}.json`);
  fs.writeFileSync(coverageFileName, JSON.stringify(coverageData));
}
