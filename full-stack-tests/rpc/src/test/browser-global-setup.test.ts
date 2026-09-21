/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { ChildProcess, spawn } from "node:child_process";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TestProject } from "vitest/node" with { "resolution-mode": "import" };
import setup from "../browser-global-setup";

vi.mock("node:child_process", async (original) => ({
  ...await original<typeof import("node:child_process")>(),
  spawn: vi.fn(),
}));
vi.mock("node:fs", () => ({ rmSync: vi.fn() }));

let backend: ChildProcess;
const catchError = vi.fn();
const kill = vi.fn<ChildProcess["kill"]>();
const warning = vi.fn(() => true);
const cancelCurrentRun = vi.fn(async () => {});
const closeBrowser = vi.fn(async () => {});
const project = {
  isRootProject: () => true,
  vitest: { state: { catchError }, cancelCurrentRun, projects: [{ browser: { provider: { close: closeBrowser } } }] },
} as unknown as TestProject;

function notifyReady(overrides = {}) {
  const options = vi.mocked(spawn).mock.calls.at(-1)?.[2];
  backend.emit("message", {
    type: "rpc-browser-ready",
    backendId: options?.env?.VITEST_RPC_BACKEND_ID,
    environment: "http",
    pid: backend.pid,
    ...overrides,
  });
}

async function start() {
  const pending = setup(project);
  notifyReady();
  const stop = await pending;
  expect(stop).toBeTypeOf("function");
  return stop!;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.clearAllMocks();
  vi.stubEnv("VITEST_RPC_ENVIRONMENT", "http");
  vi.stubEnv("VITEST_RPC_DEBUG", "0");
  vi.stubGlobal("fetch", vi.fn(async () => new Response("Success", {
    headers: { "x-vitest-rpc-backend-id": vi.mocked(spawn).mock.calls.at(-1)?.[2]?.env?.VITEST_RPC_BACKEND_ID ?? "" },
  })));
  vi.spyOn(process.stderr, "write").mockImplementation(warning);
  backend = new ChildProcess();
  Object.defineProperty(backend, "pid", { value: 12345 });
  kill.mockImplementation((signal) => {
    queueMicrotask(() => {
      Object.defineProperty(backend, "signalCode", { value: signal });
      backend.emit("exit", null, signal);
      backend.emit("close", null, signal);
    });
    return true;
  });
  backend.kill = kill;
  vi.mocked(spawn).mockReturnValue(backend);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("RPC browser backend lifecycle", () => {
  it("does not spawn another backend for inherited browser projects", async () => {
    await setup({ ...project, isRootProject: () => false } as TestProject);
    expect(spawn).not.toHaveBeenCalled();
  });

  it("waits for the owned child's ready signal, not an unrelated HTTP listener", async () => {
    let ready = false;
    const pending = setup(project).then((stop) => { ready = true; return stop; });
    await vi.advanceTimersByTimeAsync(100);
    expect(ready).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    notifyReady();
    await (await pending)!();
  });

  it.each([{ backendId: "another-run" }, { pid: 99999 }, { environment: "websocket" }])("rejects mismatched readiness: %j", async (identity) => {
    const pending = setup(project);
    const rejected = expect(pending).rejects.toThrow("readiness identity mismatch");
    notifyReady(identity);
    await rejected;
  });

  it("rejects an unrelated HTTP listener even after the owned child reports ready", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("Success"));
    const pending = setup(project);
    const rejected = expect(pending).rejects.toThrow("HTTP readiness identity mismatch");
    notifyReady();
    await rejected;
  });

  it("reports startup failure without waiting for the startup timeout", async () => {
    const pending = setup(project);
    const rejected = expect(pending).rejects.toThrow("exited unexpectedly");
    Object.defineProperty(backend, "signalCode", { value: "SIGABRT" });
    backend.emit("exit", null, "SIGABRT");
    backend.emit("close", null, "SIGABRT");
    await rejected;
    expect(catchError).not.toHaveBeenCalled();
  });

  it("bounds normal startup", async () => {
    const pending = setup(project);
    const rejected = expect(pending).rejects.toThrow("Timed out waiting");
    await vi.advanceTimersByTimeAsync(30000);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("permits debugger pauses during startup", async () => {
    vi.stubEnv("VITEST_RPC_DEBUG", "1");
    const debugging = setup(project);
    await vi.advanceTimersByTimeAsync(60000);
    expect(vi.mocked(spawn).mock.calls.at(-1)?.[1]).toContain("--inspect=127.0.0.1:5858");
    notifyReady();
    await (await debugging)!();
  });

  it("preserves a spawn error as the startup failure", async () => {
    const pending = setup(project);
    const rejected = expect(pending).rejects.toThrow("spawn failed");
    backend.emit("error", new Error("spawn failed"));
    backend.emit("close", -1, null);
    await rejected;
  });

  it("fails and cancels the run when the initialized backend exits unexpectedly", async () => {
    const stop = await start();
    Object.defineProperty(backend, "exitCode", { value: 1 });
    backend.emit("exit", 1, null);
    backend.emit("close", 1, null);
    expect(catchError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining("exited unexpectedly") }), "RPC browser backend");
    expect(cancelCurrentRun).toHaveBeenCalledWith("test-failure");
    expect(closeBrowser).toHaveBeenCalledOnce();
    await stop();
  });

  it("does not escalate an already completed signal exit", async () => {
    const stop = await start();
    await stop();
    expect(kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
    expect(catchError).not.toHaveBeenCalled();
    expect(cancelCurrentRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for close after SIGKILL rather than releasing ownership immediately", async () => {
    const stop = await start();
    kill.mockReturnValue(true);
    let stopped = false;
    const stopping = stop().then(() => { stopped = true; });
    await vi.advanceTimersByTimeAsync(5000);
    expect(kill).toHaveBeenLastCalledWith("SIGKILL");
    expect(stopped).toBe(false);
    Object.defineProperty(backend, "signalCode", { value: "SIGKILL" });
    backend.emit("exit", null, "SIGKILL");
    backend.emit("close", null, "SIGKILL");
    await stopping;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("warns without failing teardown if forced termination cannot be confirmed", async () => {
    const stop = await start();
    kill.mockReturnValue(false);
    const unref = vi.spyOn(backend, "unref");
    const disconnect = vi.fn();
    backend.disconnect = disconnect;
    const output = new PassThrough();
    Object.defineProperties(backend, { connected: { value: true }, stdout: { value: output } });
    const stopping = stop();
    await vi.advanceTimersByTimeAsync(10000);
    await expect(stopping).resolves.toBeUndefined();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining("could not confirm"));
    expect(unref).toHaveBeenCalledOnce();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(output.destroyed).toBe(true);
    expect(catchError).not.toHaveBeenCalled();
    expect(cancelCurrentRun).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
