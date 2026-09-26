/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import type { TestProject } from "vitest/node" with { "resolution-mode": "import" };
import { rpcBackendIdentityHeader, type RpcBackendReadyMessage } from "./backend/notifyReady";

const packageRoot = path.resolve(__dirname, "..");
const frontendPort = 3020;

async function waitFor(promise: Promise<void>, timeout: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise.then(() => true),
      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), timeout); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

export default async function setup(project: TestProject) {
  // Browser projects inherit this setup. The root owns the backend for the whole run.
  if (!project.isRootProject())
    return;

  const environment = process.env.VITEST_RPC_ENVIRONMENT;
  if (environment !== "http" && environment !== "websocket")
    throw new Error(`Unsupported RPC browser environment: ${environment ?? "undefined"}.`);

  const debugging = process.env.VITEST_RPC_DEBUG === "1";
  const backendId = randomUUID();
  const cacheDir = path.join(packageRoot, "lib/backend/.cache", `browser-${environment}`);
  fs.rmSync(cacheDir, { recursive: true, force: true });
  const backend = spawn(process.execPath, [
    ...(debugging ? ["--inspect=127.0.0.1:5858"] : []),
    path.resolve(packageRoot, `lib/backend/${environment}.js`),
  ], {
    cwd: packageRoot,
    env: {
      ...process.env,
      ["VITEST_FRONTEND_PORT"]: frontendPort.toString(),
      ["VITEST_BACKEND_CACHE_DIR"]: cacheDir,
      ["VITEST_RPC_BACKEND_ID"]: backendId,
    },
    stdio: ["ignore", "pipe", "pipe", "ipc"],
  });
  backend.stdout?.on("data", (data: Buffer) => process.stderr.write(`[rpc-${environment}] ${data.toString()}`));
  backend.stderr?.on("data", (data: Buffer) => process.stderr.write(`[rpc-${environment}] ${data.toString()}`));

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

    project.vitest.state.catchError(error, "RPC browser backend");
    // Closing the browsers interrupts RPC calls that cannot finish after backend death.
    void Promise.all([
      project.vitest.cancelCurrentRun("test-failure"),
      ...project.vitest.projects.map(async (consumer) => consumer.browser?.provider?.close()),
    ]).catch((cleanupError: unknown) => process.stderr.write(`RPC browser cleanup after backend failure: ${String(cleanupError)}\n`));
  };
  const closed = new Promise<void>((resolve) => backend.once("close", () => resolve()));
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    backend.on("message", (message) => {
      const notification = message as Partial<RpcBackendReadyMessage> | null;
      if (notification?.type !== "rpc-browser-ready")
        return;
      if (notification.backendId !== backendId || notification.environment !== environment || notification.pid !== backend.pid) {
        fail(new Error(`${environment} backend readiness identity mismatch.`));
        return;
      }
      resolve();
    });
  });
  backend.on("error", fail);
  backend.once("exit", (code, signal) => fail(new Error(`${environment} backend ${backend.pid} exited unexpectedly (code ${code}, signal ${signal}).`)));

  let teardown: Promise<void> | undefined;
  const stop = async () => {
    if (teardown)
      return teardown;
    stopping = true;
    teardown = (async () => {
      try {
        const isAlive = () => backend.pid !== undefined && backend.exitCode === null && backend.signalCode === null;
        if (isAlive())
          backend.kill("SIGTERM");
        if (await waitFor(closed, 5000))
          return;
        if (isAlive())
          backend.kill("SIGKILL");
        if (!await waitFor(closed, 5000))
          process.stderr.write(`Warning: RPC ${environment} cleanup could not confirm backend ${backend.pid} termination; continuing teardown.\n`);
      } finally {
        // An unconfirmed close must not leave handles keeping the test runner alive.
        backend.unref();
        backend.stdout?.destroy();
        backend.stderr?.destroy();
        if (backend.connected)
          backend.disconnect();
      }
    })().catch((error: unknown) => {
      process.stderr.write(`Warning: RPC ${environment} backend cleanup failed; continuing teardown: ${String(error)}\n`);
    });
    return teardown;
  };

  try {
    if (debugging)
      await ready;
    else if (!await waitFor(ready, 30000))
      throw new Error(`Timed out waiting for the ${environment} backend ${backend.pid} to initialize.`);
    const response = await fetch(`http://127.0.0.1:${frontendPort + 2000}/ping`, {
      signal: debugging ? undefined : AbortSignal.timeout(5000),
    });
    if (!response.ok || response.headers.get(rpcBackendIdentityHeader) !== backendId)
      throw new Error(`${environment} backend HTTP readiness identity mismatch.`);
    if (failure)
      throw failure;
    initialized = true;
  } catch (error) {
    await stop();
    throw error;
  }

  return stop;
}
