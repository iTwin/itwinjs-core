/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { once } from "node:events";
import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

const packageRoot = path.resolve(__dirname, "..");
const frontendPort = 3020;
const backendPort = frontendPort + 2000;

async function delay(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend(backendProcess: ChildProcess, environment: string): Promise<void> {
  const url = `http://127.0.0.1:${backendPort}/ping`;
  const deadline = Date.now() + 30000;

  while (Date.now() < deadline) {
    if (backendProcess.exitCode !== null)
      throw new Error(`${environment} backend exited before becoming ready with code ${backendProcess.exitCode}.`);

    try {
      const response = await fetch(url);
      if (response.ok)
        return;
    } catch {
      // The backend is still starting.
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for the ${environment} backend at ${url}.`);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForExistingBackend(environment: string, statePath: string): Promise<boolean> {
  const url = `http://127.0.0.1:${backendPort}/ping`;
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
      const state = JSON.parse(fs.readFileSync(statePath, "utf8")) as { pid?: number };
      if (state.pid !== undefined && !isProcessAlive(state.pid)) {
        fs.rmSync(statePath, { force: true });
        return false;
      }
    } catch {
      // The owner may still be writing the state file.
    }

    await delay(100);
  }

  throw new Error(`Timed out waiting for the ${environment} backend owned by another Vitest setup.`);
}

function claimBackend(statePath: string): boolean {
  try {
    const descriptor = fs.openSync(statePath, "wx");
    fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid }));
    fs.closeSync(descriptor);
    return true;
  } catch (error: unknown) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST")
      return false;
    throw error;
  }
}

async function stopBackend(backendProcess: ChildProcess): Promise<void> {
  if (backendProcess.exitCode !== null)
    return;

  backendProcess.kill("SIGTERM");
  await Promise.race([once(backendProcess, "exit"), delay(5000)]);
  if (backendProcess.exitCode === null)
    backendProcess.kill("SIGKILL");
}

export default async function setup() {
  const environment = process.env.VITEST_RPC_ENVIRONMENT;
  if (environment !== "http" && environment !== "websocket")
    throw new Error(`Unsupported RPC browser environment: ${environment ?? "undefined"}.`);

  // Vitest invokes global setup more than once for browser projects. Only the setup that claims
  // this file owns the fixed-port backend; other setups reuse it and do not tear it down. The lock
  // is required because the browser and backend share fixed ports.
  const statePath = path.join(packageRoot, "lib/backend/.vitest", `${environment}.json`);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  if (!claimBackend(statePath)) {
    if (await waitForExistingBackend(environment, statePath))
      return async () => { };

    fs.rmSync(statePath, { force: true });
    if (!claimBackend(statePath))
      throw new Error(`Could not claim the ${environment} backend setup.`);
  }

  const cacheDir = path.join(packageRoot, "lib/backend/.cache", `browser-${environment}`);
  fs.rmSync(cacheDir, { recursive: true, force: true });

  const backend = spawn(process.execPath, [path.resolve(packageRoot, `lib/backend/${environment}.js`)], {
    cwd: packageRoot,
    env: {
      ...process.env,
      ["VITEST_FRONTEND_PORT"]: frontendPort.toString(),
      ["VITEST_BACKEND_CACHE_DIR"]: cacheDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  fs.writeFileSync(statePath, JSON.stringify({ pid: backend.pid }));
  backend.stdout?.on("data", (data: Buffer) => process.stderr.write(`[rpc-${environment}] ${data.toString()}`));
  backend.stderr?.on("data", (data: Buffer) => process.stderr.write(`[rpc-${environment}] ${data.toString()}`));

  try {
    await waitForBackend(backend, environment);
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
