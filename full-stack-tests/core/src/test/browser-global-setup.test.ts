/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import setup from "../browser-global-setup";
import { chromeBackendStartupTimeout } from "../common/ChromeTestBackend";

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
vi.mock("node:fs", () => ({ rmSync: vi.fn() }));

class BackendProcess extends EventEmitter {
  public pid: number | undefined = 12345;
  public exitCode: number | null = null;
  public signalCode: NodeJS.Signals | null = null;
  public readonly stdout = new EventEmitter();
  public readonly stderr = new EventEmitter();
  public autoClose = true;
  public readonly kill = vi.fn((signal: NodeJS.Signals) => {
    if (this.autoClose)
      queueMicrotask(() => this.close(null, signal));
    return true;
  });

  public ready(overrides?: { backendId?: string, pid?: number }) {
    this.emit("message", {
      type: "core-chrome-ready",
      backendId: mocks.spawn.mock.lastCall?.[2].env.VITEST_CORE_BACKEND_ID,
      pid: this.pid,
      ...overrides,
    });
  }

  public exit(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }

  public close(code: number | null, signal: NodeJS.Signals | null = null) {
    this.exit(code, signal);
    this.emit("close", code, signal);
  }
}

function createProjects() {
  const provider = { close: vi.fn().mockResolvedValue(undefined) };
  const vitest = {
    state: { catchError: vi.fn() },
    cancelCurrentRun: vi.fn().mockResolvedValue(undefined),
    projects: [{ browser: { provider } }],
  };
  const root = { vitest, isRootProject: () => true, provide: vi.fn() };
  const browser = { vitest, isRootProject: () => false, provide: vi.fn() };
  return { root, browser, vitest, provider };
}

const start = setup as unknown as (project: ReturnType<typeof createProjects>["root"]) => Promise<undefined | (() => Promise<void>)>;
const flush = async () => new Promise<void>((resolve) => setImmediate(resolve));
let backend: BackendProcess;

beforeEach(() => {
  backend = new BackendProcess();
  mocks.spawn.mockReset().mockReturnValue(backend);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
});

afterEach(async () => {
  backend.close(0);
  if (vi.isFakeTimers())
    await vi.runAllTimersAsync();
  else
    await flush();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("core Chrome backend ownership", () => {
  it("leaves backend ownership to the root rather than spawning for the browser project", async () => {
    const { browser } = createProjects();
    expect(await start(browser)).toBeUndefined();
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("waits for the owned backend's initialization even if an HTTP server already answers", async () => {
    const { root } = createProjects();
    const resolved = vi.fn();
    const opening = start(root);
    void opening.then(resolved, () => undefined);
    await flush();
    expect(resolved).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledOnce();
    backend.ready();
    const teardown = await opening;
    expect(root.provide).toHaveBeenCalledWith("coreChromeBackendId", expect.any(String));
    expect(fetch).not.toHaveBeenCalled();
    await teardown?.();
  });

  it("rejects a readiness message belonging to another backend", async () => {
    const { root } = createProjects();
    const opening = start(root);
    const rejection = expect(opening).rejects.toThrow(/identity/i);
    backend.ready({ backendId: "another-run", pid: 99999 });
    await rejection;
    expect(root.provide).not.toHaveBeenCalled();
    expect(backend.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("rejects a backend that exits immediately after announcing readiness", async () => {
    const { root } = createProjects();
    const opening = start(root);
    const rejection = expect(opening).rejects.toThrow(/12345.*23/);
    backend.ready();
    backend.close(23);
    await rejection;
    expect(root.provide).not.toHaveBeenCalled();
    expect(backend.kill).not.toHaveBeenCalled();
  });

  it("handles a spawn failure without trying to signal an unowned PID", async () => {
    const { root } = createProjects();
    backend.pid = undefined;
    const opening = start(root);
    const rejection = expect(opening).rejects.toThrow("spawn ENOENT");
    backend.emit("error", new Error("spawn ENOENT"));
    backend.close(-2);
    await rejection;
    expect(root.provide).not.toHaveBeenCalled();
    expect(backend.kill).not.toHaveBeenCalled();
  });

  it("cleans up when initialization never reaches the existing startup deadline", async () => {
    vi.useFakeTimers();
    const { root } = createProjects();
    const opening = start(root);
    const rejection = expect(opening).rejects.toThrow(/timed out.*initialize/i);
    await vi.advanceTimersByTimeAsync(chromeBackendStartupTimeout);
    await rejection;
    expect(root.provide).not.toHaveBeenCalled();
    expect(backend.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("does not let the browser project's teardown terminate the root's backend", async () => {
    const { root, browser } = createProjects();
    const opening = start(root);
    backend.ready();
    const teardownRoot = await opening;
    const teardownBrowser = await start(browser);
    await teardownBrowser?.();
    expect(backend.kill).not.toHaveBeenCalled();
    await teardownRoot?.();
    await teardownRoot?.();
    expect(backend.kill).toHaveBeenCalledOnce();
  });

  it("reports an unexpected exit, cancels the run, and closes the browser to interrupt pending hooks", async () => {
    const { root, vitest, provider } = createProjects();
    const opening = start(root);
    backend.ready();
    const teardown = await opening;
    backend.close(17);
    await flush();
    expect(vitest.state.catchError).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/12345.*17/) }), expect.any(String));
    expect(vitest.cancelCurrentRun).toHaveBeenCalledWith("test-failure");
    expect(provider.close).toHaveBeenCalledOnce();
    await teardown?.();
  });

  it("waits for process close and treats a signal exit as terminated", async () => {
    const { root, vitest } = createProjects();
    const opening = start(root);
    backend.ready();
    const teardown = await opening;
    backend.autoClose = false;
    const finished = vi.fn();
    const closing = teardown?.();
    void closing?.then(finished);
    backend.exit(null, "SIGTERM");
    await flush();
    expect(finished).not.toHaveBeenCalled();
    backend.emit("close", null, "SIGTERM");
    await closing;
    expect(backend.kill).toHaveBeenCalledTimes(1);
    expect(vitest.state.catchError).not.toHaveBeenCalled();
  });

  it("escalates a stuck process and still awaits its close", async () => {
    vi.useFakeTimers();
    const { root } = createProjects();
    const opening = start(root);
    backend.ready();
    const teardown = await opening;
    backend.autoClose = false;
    const finished = vi.fn();
    const closing = teardown?.();
    void closing?.then(finished);
    await vi.advanceTimersByTimeAsync(5000);
    expect(backend.kill.mock.calls).toEqual([["SIGTERM"], ["SIGKILL"]]);
    expect(finished).not.toHaveBeenCalled();
    backend.close(null, "SIGKILL");
    await closing;
  });
});
