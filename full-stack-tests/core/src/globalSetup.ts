/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Vitest globalSetup — starts Azurite + backend server before all tests,
// tears them down after. Guarantees cleanup even on crash/ctrl-C.
/* eslint-disable no-console */

import { type ChildProcess, spawn } from "child_process";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import * as net from "net";

const backendPort = Number(process.env.FULL_STACK_BACKEND_PORT ?? "5010");
const azuritePort = 10000;
const azuriteStorage = path.resolve(__dirname, "../lib/cjs/test/azuriteStorage");

let azuriteProc: ChildProcess | undefined;
let backendProc: ChildProcess | undefined;

/** Wait until a TCP port accepts connections, or timeout. */
// eslint-disable-next-line @typescript-eslint/promise-function-async
function waitForPort(port: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const tryConnect = () => {
      const sock = net.createConnection({ port, host: "127.0.0.1" });
      sock.on("connect", () => {
        sock.destroy();
        resolve();
      });
      sock.on("error", () => {
        sock.destroy();
        if (Date.now() > deadline)
          return reject(new Error(`Timeout waiting for port ${port}`));
        setTimeout(tryConnect, 200);
      });
    };
    tryConnect();
  });
}

/** Check if a port is already in use. */
// eslint-disable-next-line @typescript-eslint/promise-function-async
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection({ port, host: "127.0.0.1" });
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("error", () => { sock.destroy(); resolve(false); });
  });
}

/** Kill a child process and wait for exit. */
// eslint-disable-next-line @typescript-eslint/promise-function-async
function killProc(proc: ChildProcess | undefined): Promise<void> {
  if (!proc || proc.killed || proc.exitCode !== null)
    return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (!proc.killed && proc.exitCode === null)
        proc.kill("SIGKILL");
    }, 5_000);
    proc.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill("SIGTERM");
  });
}

export async function setup() {
  console.log("[globalSetup] Starting setup...");

  // --- Azurite ---
  const azuriteInUse = await isPortInUse(azuritePort);
  if (!azuriteInUse) {
    if (!existsSync(azuriteStorage))
      mkdirSync(azuriteStorage, { recursive: true });

    azuriteProc = spawn("npx", ["azurite-blob", "--silent", "--loose", "--location", azuriteStorage], {
      stdio: "pipe",
      detached: false,
      shell: true,
    });
    azuriteProc.on("error", (err) => console.error("Azurite failed to start:", err.message));
    azuriteProc.stderr?.on("data", (d: Buffer) => {
      const msg = d.toString();
      if (!msg.includes("DeprecationWarning"))
        console.error("Azurite:", msg);
    });

    await waitForPort(azuritePort);
    console.log(`Azurite started on port ${azuritePort} (pid ${azuriteProc.pid})`);
  } else {
    console.log(`Azurite already running on port ${azuritePort}, reusing`);
  }

  // --- Backend server ---
  const backendInUse = await isPortInUse(backendPort);
  if (!backendInUse) {
    const backendScript = path.resolve(__dirname, "../lib/backend/BackendServer.js");
    backendProc = spawn("node", [backendScript], {
      stdio: "pipe",
      // eslint-disable-next-line @typescript-eslint/naming-convention
      env: { ...process.env, FULL_STACK_BACKEND_PORT: String(backendPort) },
      detached: false,
    });
    backendProc.on("error", (err) => console.error("Backend failed to start:", err.message));
    backendProc.stdout?.on("data", (d: Buffer) => {
      const msg = d.toString().trim();
      if (msg) console.log("Backend:", msg);
    });
    backendProc.stderr?.on("data", (d: Buffer) => {
      const msg = d.toString();
      if (!msg.includes("DeprecationWarning"))
        console.error("Backend:", msg);
    });

    await waitForPort(backendPort);
    console.log(`Backend started on port ${backendPort} (pid ${backendProc.pid})`);
  } else {
    console.log(`Backend already running on port ${backendPort}, reusing`);
  }

  console.log("[globalSetup] Setup complete — ready for tests");
}

export async function teardown() {
  const kills = [killProc(backendProc), killProc(azuriteProc)];
  await Promise.all(kills);

  if (backendProc?.pid)
    console.log(`Backend (pid ${backendProc.pid}) stopped`);
  if (azuriteProc?.pid)
    console.log(`Azurite (pid ${azuriteProc.pid}) stopped`);

  backendProc = undefined;
  azuriteProc = undefined;
}
