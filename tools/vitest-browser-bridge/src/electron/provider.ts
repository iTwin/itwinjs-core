/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
import type { BrowserProvider, BrowserProviderOption, TestProject } from "vitest/node" with { "resolution-mode": "import" };
import {
  isProviderSessionMessage,
  type ProviderSessionConfiguration,
  SESSION_CONFIGURATION_ENV,
} from "./session-protocol.js";

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
  /** Time to wait for the provider session to report that its window is ready. */
  readonly startupTimeout?: number;
  /** Time to wait for graceful Electron process termination before escalating. */
  readonly closeTimeout?: number;
}

const DEFAULT_STARTUP_TIMEOUT = 30_000;
const DEFAULT_CLOSE_TIMEOUT = 5_000;
const FORCE_KILL_TIMEOUT = 1_000;

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

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
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

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child))
    return true;

  return new Promise<boolean>((resolve) => {
    const finish = (exited: boolean) => {
      clearTimeout(timeout);
      child.off("exit", onExit);
      resolve(exited);
    };
    const onExit = () => finish(true);
    const timeout = setTimeout(() => finish(false), timeoutMs);
    child.once("exit", onExit);
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
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      child.off("message", onMessage);
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
    const onMessage = (message: unknown) => {
      if (!isProviderSessionMessage(message) || message.sessionId !== sessionId)
        return;
      if (message.type === "ready")
        settleResolve();
      else
        settleReject(new Error(`Electron provider session ${sessionId} failed: ${message.message}`));
    };
    const onError = (error: Error) => settleReject(error);
    const onExit = (code: number | null, signal: NodeJS.Signals | null) => settleReject(new Error(
      `Electron provider session ${sessionId} exited before ready: code=${code ?? "none"}, signal=${signal ?? "none"}`,
    ));

    const timeout = setTimeout(() => settleReject(new Error(
      `Timed out after ${timeoutMs}ms waiting for Electron provider session ${sessionId} to load ${url}`,
    )), timeoutMs);
    child.on("message", onMessage);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

class ElectronSession {
  private readonly _child: ChildProcess;
  private _closePromise: Promise<void> | undefined;
  private _ready = false;

  public constructor(
    projectRoot: string,
    sessionEntryPath: string,
    configuration: ProviderSessionConfiguration,
    options: ElectronProviderOptions,
    private readonly _closeTimeout: number,
  ) {
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      ...options.env,
      [SESSION_CONFIGURATION_ENV]: JSON.stringify(configuration),
    };

    this._child = spawn(
      resolveElectronBinary(projectRoot, options),
      [...(options.electronArgs ?? []), sessionEntryPath],
      {
        cwd: projectRoot,
        env: environment,
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        detached: process.platform !== "win32",
      },
    );
    this._child.on("error", (error) => {
      if (this._ready)
        console.error(`Electron provider session ${configuration.sessionId} process error:`, error);
    });
    this._child.once("exit", () => cleanupCacheDir(configuration.cacheDir));
  }

  public async start(configuration: ProviderSessionConfiguration, timeoutMs: number): Promise<void> {
    await waitForReady(this._child, configuration.sessionId, configuration.url, timeoutMs);
    this._ready = true;
  }

  public async close(): Promise<void> {
    this._closePromise ??= this._close();
    await this._closePromise;
  }

  private async _close(): Promise<void> {
    if (hasExited(this._child))
      return;

    try {
      if (this._child.connected) {
        this._child.send({ type: "shutdown" }, (error) => {
          if (error !== null && !hasExited(this._child))
            signalChildProcess(this._child, "SIGTERM");
        });
      } else
        signalChildProcess(this._child, "SIGTERM");
    } catch {
      signalChildProcess(this._child, "SIGTERM");
    }

    if (await waitForExit(this._child, this._closeTimeout))
      return;

    signalChildProcess(this._child, "SIGTERM");
    if (await waitForExit(this._child, FORCE_KILL_TIMEOUT))
      return;

    signalChildProcess(this._child, "SIGKILL");
    if (!await waitForExit(this._child, FORCE_KILL_TIMEOUT))
      throw new Error(`Electron provider process ${this._child.pid ?? "unknown"} did not exit after SIGKILL.`);
  }
}

/** A Vitest 4 BrowserProvider that owns only Electron process and window lifecycle.
 * @internal
 */
export class ElectronBrowserProvider implements BrowserProvider {
  public readonly name = "electron";
  public readonly supportsParallelism = false;

  private _session: ElectronSession | undefined;
  private _closed = false;
  private _closePromise: Promise<void> | undefined;
  private _lifecycle: Promise<void> = Promise.resolve();

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
    if (parallel)
      throw new Error("The Electron BrowserProvider does not support parallel sessions.");

    return this._enqueue(async () => {
      if (this._closed)
        throw new Error("The Electron BrowserProvider is already closed.");

      const previousSession = this._session;
      this._session = undefined;
      await previousSession?.close();
      if (this._closed)
        throw new Error("The Electron BrowserProvider is already closed.");

      const projectRoot = this._project.config.root;
      const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `vitest-browser-bridge-${safeSessionId(sessionId)}-`));
      const configuration: ProviderSessionConfiguration = {
        url,
        sessionId,
        cacheDir,
        headless: this._project.config.browser.headless !== false,
        ...(this._options.backendInitModule === undefined ? {} : { backendInitModule: this._options.backendInitModule }),
        ...(this._options.preloadModule === undefined ? {} : { preloadModule: this._options.preloadModule }),
      };

      let session: ElectronSession;
      try {
        session = new ElectronSession(
          projectRoot,
          this._sessionEntryPath,
          configuration,
          this._options,
          this._options.closeTimeout ?? DEFAULT_CLOSE_TIMEOUT,
        );
      } catch (error) {
        cleanupCacheDir(cacheDir);
        throw error;
      }
      this._session = session;

      try {
        await session.start(configuration, this._options.startupTimeout ?? DEFAULT_STARTUP_TIMEOUT);
      } catch (error) {
        if (this._session === session)
          this._session = undefined;
        try {
          await session.close();
        } catch (cleanupError) {
          console.error(`Failed to terminate Electron provider session ${sessionId}:`, cleanupError);
        }
        throw error;
      }
    });
  }

  public async close(): Promise<void> {
    if (this._closePromise === undefined) {
      this._closed = true;
      const activeClose = this._session?.close();
      void activeClose?.catch(() => {});
      this._closePromise = this._enqueue(async () => {
        const session = this._session;
        this._session = undefined;
        await (activeClose ?? session?.close());
      });
    }
    await this._closePromise;
  }

  private async _enqueue<Return>(operation: () => Promise<Return>): Promise<Return> {
    const result = this._lifecycle.then(operation, operation);
    this._lifecycle = result.then(() => undefined, () => undefined);
    return result;
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
