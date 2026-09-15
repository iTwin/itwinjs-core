/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TestProject } from "vitest/node" with { "resolution-mode": "import" };
import { ChromeBackendReadyMessage, chromeBackendStartupTimeout } from "./common/ChromeTestBackend";

const packageRoot = path.resolve(__dirname, "..");

async function waitFor(promise: Promise<void>, timeout: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeout);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function setup(project: TestProject) {
  // Vitest also invokes inherited global setups for browser projects. The root owns
  // the entire run, and its provided context is inherited by those projects.
  if (!project.isRootProject())
    return;

  const backendId = randomUUID();
  const cacheDir = path.join(packageRoot, "lib/backend/.cache", "browser-chrome");
  fs.rmSync(cacheDir, { recursive: true, force: true });
  const backend = spawn(process.execPath, [path.resolve(packageRoot, "lib/backend/backend.js")], {
    cwd: packageRoot,
    env: {
      ...process.env,
      ["VITEST_FRONTEND_PORT"]: "3010",
      ["VITEST_BACKEND_CACHE_DIR"]: cacheDir,
      ["VITEST_CORE_BACKEND_ID"]: backendId,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  backend.stdout?.on("data", (data: Buffer) => process.stderr.write(`[core-chrome] ${data.toString()}`));
  backend.stderr?.on("data", (data: Buffer) => process.stderr.write(`[core-chrome] ${data.toString()}`));

  let initialized = false;
  let stopping = false;
  let failure: Error | undefined;
  let rejectReady: (error: Error) => void;
  const fail = (error: Error) => {
    if (stopping || failure)
      return;
    failure = error;
    rejectReady(error);
    if (!initialized)
      return;

    project.vitest.state.catchError(error, "Core Chrome backend");
    // Cancellation alone waits for running tests. Closing their browser interrupts
    // RPC promises and hooks that cannot finish after the backend has disappeared.
    void Promise.all([
      project.vitest.cancelCurrentRun("test-failure"),
      ...project.vitest.projects.map(async (consumer) => consumer.browser?.provider?.close()),
    ]).catch((closeError) => project.vitest.state.catchError(closeError, "Core Chrome browser cleanup"));
  };
  const closed = new Promise<void>((resolve) => backend.once("close", () => resolve()));
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    backend.on("message", (message) => {
      const notification = message as Partial<ChromeBackendReadyMessage> | null;
      if (notification?.type !== "core-chrome-ready")
        return;
      if (notification.backendId !== backendId || notification.pid !== backend.pid) {
        fail(new Error(`Chrome test backend ${backend.pid} readiness identity mismatch.`));
        return;
      }
      resolve();
    });
  });
  backend.on("error", fail);
  backend.once("exit", (code, signal) => fail(new Error(`Chrome test backend ${backend.pid} exited unexpectedly (code ${code}, signal ${signal}).`)));

  let teardown: Promise<void> | undefined;
  const stop = async () => {
    if (teardown)
      return teardown;
    stopping = true;
    teardown = (async () => {
      const isAlive = () => backend.pid !== undefined && backend.exitCode === null && backend.signalCode === null;
      if (isAlive())
        backend.kill("SIGTERM");
      try {
        await waitFor(closed, 5000, `Chrome test backend ${backend.pid} did not close after SIGTERM.`);
      } catch (error) {
        if (!isAlive())
          throw error;
        backend.kill("SIGKILL");
        await waitFor(closed, 5000, `Chrome test backend ${backend.pid} did not close after SIGKILL.`);
      }
    })();
    return teardown;
  };

  try {
    await waitFor(ready, chromeBackendStartupTimeout, `Timed out waiting for Chrome test backend ${backend.pid} to initialize.`);
    if (failure)
      throw failure;
    project.provide("coreChromeBackendId", backendId);
    initialized = true;
  } catch (error) {
    await stop().catch((closeError) => project.vitest.state.catchError(closeError, "Core Chrome backend cleanup"));
    throw error;
  }

  return stop;
}
