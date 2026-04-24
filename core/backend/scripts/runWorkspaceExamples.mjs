/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import * as net from "node:net";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdirSync } from "node:fs";

/** @typedef {import("node:child_process").ChildProcess} ChildProcess */

const require = createRequire(import.meta.url);
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(scriptDir, "..");
const azuriteStorageDir = path.join(packageDir, "lib/cjs/test/azuriteStorage");
const mochaReporter = require.resolve("@itwin/build-tools/mocha-reporter");
const azuritePackageJson = require.resolve("azurite/package.json");
const azuritePackage = require(azuritePackageJson);
const azuriteEntryPoint = path.join(path.dirname(azuritePackageJson), azuritePackage.bin["azurite-blob"]);
/** @type {string[]} */
const mochaArgs = [
  require.resolve("mocha/bin/mocha.js"),
  "--no-config",
  "--check-leaks",
  "--timeout", "30000",
  "--require", "source-map-support/register",
  "--reporter", mochaReporter,
  "--reporter-options", "mochaFile=lib/test/junit_results_workspace_examples.xml",
  path.join(packageDir, "lib/cjs/test/TestUtils.js"),
  path.join(packageDir, "lib/cjs/test/example-code/AzuriteTest.js"),
  path.join(packageDir, "lib/cjs/test/example-code/WorkspaceExamples.test.js"),
];

/**
 * @param {string} entryPoint
 * @param {string[]} args
 */
function spawnNodeProcess(entryPoint, args) {
  return spawn(process.execPath, [entryPoint, ...args], {
    cwd: packageDir,
    stdio: "inherit",
  });
}

/**
 * @param {number} port
 * @param {string} host
 * @param {number} timeoutMs
 * @returns {Promise<void>}
 */
async function waitForPort(port, host, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const connected = await new Promise(
      /**
       * @param {(value: boolean) => void} resolve
       * @returns {void}
       */
      function (resolve) {
        const socket = net.createConnection({ port, host });
        socket.once("connect", () => {
          socket.destroy();
          resolve(true);
        });
        socket.once("error", () => resolve(false));
      },
    );

    if (connected)
      return;

    await new Promise(
      /** @param {(value: undefined) => void} resolve */
      (resolve) => {
        setTimeout(() => resolve(undefined), 250);
      },
    );
  }

  throw new Error(`Timed out waiting for Azurite on ${host}:${port}`);
}

/**
 * @param {ChildProcess} child
 * @returns {Promise<{ code: number | null, signal: string | null }>}
 */
async function waitForExit(child) {
  return new Promise(
    /**
     * @param {(value: { code: number | null, signal: string | null }) => void} resolve
     * @param {(error: Error) => void} reject
     * @returns {void}
     */
    function (resolve, reject) {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", reject);
    },
  );
}

/**
 * @param {ChildProcess} child
 * @returns {Promise<void>}
 */
async function stopProcess(child) {
  if (child.exitCode !== null)
    return;

  child.kill("SIGTERM");
  const exited = await Promise.race([
    waitForExit(child).then(() => true),
    new Promise(
      /** @param {(value: false) => void} resolve */
      (resolve) => {
        setTimeout(() => resolve(false), 5000);
      },
    ),
  ]);

  if (exited)
    return;

  child.kill("SIGKILL");
  await waitForExit(child);
}

/** @returns {Promise<void>} */
async function main() {
  mkdirSync(azuriteStorageDir, { recursive: true });

  const azurite = spawnNodeProcess(azuriteEntryPoint, [
    "--blobPort", "10001",
    "--silent",
    "--loose",
    "--location", azuriteStorageDir,
  ]);

  try {
    await Promise.race([
      waitForPort(10001, "127.0.0.1", 15000),
      waitForExit(azurite).then(({ code, signal }) => {
        throw new Error(`Azurite exited before becoming ready (code: ${code ?? "null"}, signal: ${signal ?? "null"})`);
      }),
    ]);

    const mocha = spawn(process.execPath, mochaArgs, {
      cwd: packageDir,
      stdio: "inherit",
    });
    const result = await waitForExit(mocha);
    process.exitCode = result.code ?? (result.signal ? 1 : 0);
  } finally {
    await stopProcess(azurite);
  }
}

await main();
