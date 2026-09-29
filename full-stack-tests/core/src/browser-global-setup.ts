/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { once } from "node:events";
import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TestProject } from "vitest/node" with { "resolution-mode": "import" };
import { backendCallbackTokenEnvVar, backendCallbackTokenKey, createBackendCallbackToken } from "@itwin/vitest-browser-bridge/callbacks/http";
import { backendPortFor, frontendPortEnvVar, loopbackHost, parseFrontendPort } from "./common/BrowserTestPorts";

const packageRoot = path.resolve(__dirname, "..");

/** What the setup that owns the backend records for setups that reuse it. */
interface BackendState {
  pid?: number;
  callbackToken?: string;
}

function readBackendState(statePath: string): BackendState {
  return JSON.parse(fs.readFileSync(statePath, "utf8")) as BackendState;
}

async function delay(ms: number) {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend(process: ChildProcess, url: string) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(`Chrome test backend exited before becoming ready with code ${process.exitCode}.`);

    try {
      const response = await fetch(url);
      if (response.ok)
        return;
    } catch {
      // The backend is still starting.
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for the Chrome test backend at ${url}.`);
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExistingBackend(statePath: string, url: string) {
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok)
        return true;
    } catch {
      // The backend owner is still starting.
    }

    if (!fs.existsSync(statePath))
      return false;

    try {
      const state = readBackendState(statePath);
      if (state.pid !== undefined && !isProcessAlive(state.pid)) {
        fs.rmSync(statePath, { force: true });
        return false;
      }
    } catch {
      // The owner may still be writing the state file.
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for the Chrome test backend owned by another Vitest setup.`);
}

function claimBackend(statePath: string) {
  try {
    // The state file later holds the callback token, so only this user may read it.
    const descriptor = fs.openSync(statePath, "wx", 0o600);
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid }));
    fs.closeSync(descriptor);
    return true;
  } catch (error: any) {
    if (error.code === "EEXIST")
      return false;
    throw error;
  }
}

async function stopBackend(process: ChildProcess) {
  if (process.exitCode !== null)
    return;

  process.kill("SIGTERM");
  await Promise.race([once(process, "exit"), delay(5000)]);
  if (process.exitCode === null)
    process.kill("SIGKILL");
}

export default async function setup(project: TestProject) {
  // Use the page port Vitest actually resolved so the backend always matches the page.
  const frontendPort = parseFrontendPort(project.config.browser.api.port, "Vitest browser.api.port");
  const pingUrl = `http://${loopbackHost}:${backendPortFor(frontendPort)}/ping`;
  const statePath = path.join(packageRoot, "lib/backend/.vitest/chrome.json");
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  if (!claimBackend(statePath)) {
    if (await waitForExistingBackend(statePath, pingUrl)) {
      // Reuse the running backend, and give this setup's browsers the token it accepts.
      const recordedToken = readBackendState(statePath).callbackToken;
      if (recordedToken === undefined)
        throw new Error("The running Chrome test backend did not record a callback token.");
      project.provide(backendCallbackTokenKey, recordedToken);
      return async () => { };
    }

    fs.rmSync(statePath, { force: true });
    if (!claimBackend(statePath))
      throw new Error("Could not claim the Chrome test backend setup.");
  }

  const cacheDir = path.join(packageRoot, "lib/backend/.cache", "browser-chrome");
  fs.rmSync(cacheDir, { recursive: true, force: true });

  const callbackToken = createBackendCallbackToken();
  const backend = spawn(process.execPath, [path.resolve(packageRoot, "lib/backend/backend.js")], {
    cwd: packageRoot,
    env: {
      ...process.env,
      [frontendPortEnvVar]: frontendPort.toString(),
      [backendCallbackTokenEnvVar]: callbackToken,
      ["VITEST_BACKEND_CACHE_DIR"]: cacheDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const state: BackendState = { pid: backend.pid, callbackToken };
  fs.writeFileSync(statePath, JSON.stringify(state), { mode: 0o600 });
  project.provide(backendCallbackTokenKey, callbackToken);
  backend.stdout?.on("data", (data: Buffer) => process.stderr.write(`[core-chrome] ${data.toString()}`));
  backend.stderr?.on("data", (data: Buffer) => process.stderr.write(`[core-chrome] ${data.toString()}`));

  try {
    await waitForBackend(backend, pingUrl);
  } catch (error) {
    await stopBackend(backend);
    fs.rmSync(statePath, { force: true });
    throw error;
  }

  return async () => {
    await stopBackend(backend);
    fs.rmSync(statePath, { force: true });
  };
}
