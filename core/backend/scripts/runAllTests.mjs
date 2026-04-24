/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { spawn } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** @typedef {import("node:child_process").ChildProcess} ChildProcess */

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const npmExecPath = process.env.npm_execpath;

if (!npmExecPath)
  throw new Error("npm_execpath is not defined");

/**
 * @param {string} scriptName
 * @returns {Promise<{ code: number | null, signal: string | null }>}
 */
async function runPackageScript(scriptName) {
  return new Promise(
    /**
     * @param {(value: { code: number | null, signal: string | null }) => void} resolve
     * @param {(error: Error) => void} reject
     * @returns {void}
     */
    function (resolve, reject) {
      const child = spawn(process.execPath, [npmExecPath, "run", "-s", scriptName], {
        cwd: packageDir,
        stdio: "inherit",
      });

      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", reject);
    },
  );
}

/**
 * @param {{ code: number | null, signal: string | null }} result
 * @returns {number}
 */
function getExitCode(result) {
  return result.code ?? (result.signal ? 1 : 0);
}

/** @returns {Promise<void>} */
async function main() {
  const mainSuiteResult = await runPackageScript("test:main");
  const workspaceExamplesResult = await runPackageScript("test:workspace-examples");
  process.exitCode = getExitCode(mainSuiteResult) !== 0 || getExitCode(workspaceExamplesResult) !== 0 ? 1 : 0;
}

await main();
