/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import type { BrowserProvider, BrowserProviderOption, TestProject } from "vitest/node";

interface ElectronSession {
  readonly child: ChildProcess;
  readonly cacheDir: string;
}

/** Options for the Electron BrowserProvider.
 * @internal
 */
export interface ElectronProviderOptions {
  /** Absolute path to an optional backend initialization module. */
  readonly backendInitModule?: string;
  /** Absolute path to an optional consumer preload module. */
  readonly preloadModule?: string;
  /** Electron executable override, primarily useful for focused lifecycle tests. */
  readonly electronBinary?: string;
  /** Additional arguments passed to Electron before the provider session entrypoint. */
  readonly electronArgs?: readonly string[];
  /** Additional environment variables passed to the Electron main process. */
  readonly env?: NodeJS.ProcessEnv;
  /** Time to wait for the provider session to print its ready marker. */
  readonly startupTimeout?: number;
  /** Time to wait for an Electron process to terminate during provider teardown. */
  readonly closeTimeout?: number;
}

const DEFAULT_STARTUP_TIMEOUT = 30_000;
const DEFAULT_CLOSE_TIMEOUT = 5_000;

function cleanupCacheDir(cacheDir: string): void {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // Teardown is best effort after the child process has gone away.
  }
}

function safeSessionId(sessionId: string): string {
  return sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function signalChildProcess(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid !== undefined && process.platform !== "win32") {
    try {
      // Electron launches utility and renderer helpers. A detached process group lets provider
      // teardown terminate those children rather than leaving them behind as orphan processes.
      process.kill(-child.pid, signal);
    } catch {
      // The process group may already have exited.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // The process may have exited between the group and direct kill calls.
  }
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null)
    return Promise.resolve();

  return new Promise<void>((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled)
        return;
      settled = true;
      if (killTimer !== undefined)
        clearTimeout(killTimer);
      if (giveUpTimer !== undefined)
        clearTimeout(giveUpTimer);
      resolve();
    };

    const killTimer = setTimeout(() => signalChildProcess(child, "SIGKILL"), timeoutMs);
    const giveUpTimer = setTimeout(finish, timeoutMs + 1_000);
    child.once("exit", finish);
    giveUpTimer.unref();
  });
}

function resolveElectronBinary(projectRoot: string, options: ElectronProviderOptions): string {
  if (options.electronBinary !== undefined)
    return options.electronBinary;

  const projectRequire = createRequire(path.join(projectRoot, "package.json"));
  const electronBinary = projectRequire("electron");
  if (typeof electronBinary !== "string")
    throw new Error("The Electron package did not resolve to an executable path.");
  return electronBinary;
}

async function waitForReady(child: ChildProcess, sessionId: string, url: string, timeoutMs: number): Promise<void> {
  const marker = `[vitest-browser-bridge:${sessionId}] ready`;
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let output = "";

    const cleanup = () => {
      child.stdout?.off("data", onStdout);
      child.stderr?.off("data", onStderr);
      child.off("error", onError);
      child.off("exit", onExit);
      clearTimeout(timeout);
    };
    const settleResolve = () => {
      if (settled)
        return;
      settled = true;
      cleanup();
      resolve();
    };
    const settleReject = (error: Error) => {
      if (settled)
        return;
      settled = true;
      cleanup();
      reject(error);
    };
    const onStdout = (chunk: Buffer) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      if (output.includes(marker))
        settleResolve();
    };
    const onStderr = (chunk: Buffer) => process.stderr.write(chunk);
    const onError = (error: Error) => settleReject(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => settleReject(new Error(
      `Electron provider session ${sessionId} exited before ready: code=${code ?? "none"}, signal=${signal ?? "none"}`,
    ));

    const timeout = setTimeout(() => settleReject(new Error(
      `Timed out after ${timeoutMs}ms waiting for Electron provider session ${sessionId} to load ${url}`,
    )), timeoutMs);
    timeout.unref();
    child.stdout?.on("data", onStdout);
    child.stderr?.on("data", onStderr);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

/** A Vitest 4 BrowserProvider that owns only Electron process and window lifecycle.
 * @internal
 */
export class ElectronBrowserProvider implements BrowserProvider {
  public readonly name = "electron";
  public readonly supportsParallelism = false;

  private readonly _sessions = new Map<string, ElectronSession>();
  private _closing = false;

  public constructor(
    private readonly _project: TestProject,
    private readonly _options: ElectronProviderOptions,
    private readonly _sessionEntryPath: string,
  ) {}

  public getCommandsContext(_sessionId: string): Record<string, unknown> {
    // This foundation deliberately exposes no locator, input, screenshot, or custom command API.
    return {};
  }

  public async openPage(sessionId: string, url: string, { parallel }: { parallel: boolean }): Promise<void> {
    if (this._closing)
      throw new Error("The Electron BrowserProvider is already closed.");
    if (parallel)
      throw new Error("The Electron BrowserProvider does not support parallel sessions.");

    const existing = this._sessions.get(sessionId);
    if (existing !== undefined) {
      await this._terminateSession(sessionId, existing);
    }

    const projectRoot = this._project.config.root;
    const electronBinary = resolveElectronBinary(projectRoot, this._options);
    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `vitest-browser-bridge-${safeSessionId(sessionId)}-`));
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...this._options.env,
    };
    environment.VITEST_BROWSER_BRIDGE_URL = url;
    environment.VITEST_BROWSER_BRIDGE_SESSION_ID = sessionId;
    environment.VITEST_BROWSER_BRIDGE_CACHE_DIR = cacheDir;
    environment.VITEST_BROWSER_BRIDGE_HEADLESS = String(this._project.config.browser.headless !== false);
    if (this._options.backendInitModule !== undefined)
      environment.VITEST_BROWSER_BRIDGE_BACKEND_INIT = this._options.backendInitModule;
    if (this._options.preloadModule !== undefined)
      environment.VITEST_BROWSER_BRIDGE_PRELOAD = this._options.preloadModule;

    const child = spawn(electronBinary, [...(this._options.electronArgs ?? []), this._sessionEntryPath], {
      cwd: projectRoot,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    const session: ElectronSession = { child, cacheDir };
    this._sessions.set(sessionId, session);
    child.once("exit", () => {
      if (this._sessions.get(sessionId) === session)
        this._sessions.delete(sessionId);
      cleanupCacheDir(cacheDir);
    });

    try {
      await waitForReady(child, sessionId, url, this._options.startupTimeout ?? DEFAULT_STARTUP_TIMEOUT);
    } catch (error) {
      await this._terminateSession(sessionId, session);
      throw error;
    }
  }

  public async close(): Promise<void> {
    if (this._closing)
      return;
    this._closing = true;
    await Promise.all([...this._sessions.entries()].map(async ([sessionId, session]) => this._terminateSession(sessionId, session)));
    this._sessions.clear();
  }

  private async _terminateSession(sessionId: string, session: ElectronSession): Promise<void> {
    if (this._sessions.get(sessionId) === session)
      this._sessions.delete(sessionId);
    if (session.child.exitCode === null && session.child.signalCode === null)
      signalChildProcess(session.child, "SIGTERM");
    await waitForExit(session.child, this._options.closeTimeout ?? DEFAULT_CLOSE_TIMEOUT);
    cleanupCacheDir(session.cacheDir);
  }
}

/** Create the provider option consumed by Vitest 4's `browser.provider` configuration.
 * @internal
 */
export function createElectronBrowserProviderOption(options: ElectronProviderOptions, sessionEntryPath: string): BrowserProviderOption<ElectronProviderOptions> {
  return {
    name: "electron",
    supportedBrowser: ["electron"],
    options,
    providerFactory: (project) => new ElectronBrowserProvider(project, options, sessionEntryPath),
    serverFactory: async (serverOptions) => {
      const { createBrowserServer } = await import("@vitest/browser");
      return createBrowserServer(serverOptions);
    },
  };
}
