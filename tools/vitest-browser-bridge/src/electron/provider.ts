/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { defineBrowserProvider } from "@vitest/browser";
import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as os from "node:os";
import * as path from "node:path";
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
}

interface ElectronProject {
  readonly config: {
    readonly root: string;
    readonly browser: {
      readonly headless?: boolean;
    };
  };
}

interface ElectronProcessOptions {
  readonly electronBinary?: string;
  readonly electronArgs?: readonly string[];
  readonly startupTimeout?: number;
  readonly closeTimeout?: number;
}

type ProcessTermination = readonly [
  code: number | null,
  signal: NodeJS.Signals | null,
  error?: Error,
];

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

function resolveElectronBinary(projectRoot: string, override: string | undefined): string {
  if (override !== undefined)
    return override;

  const projectRequire = createRequire(path.join(projectRoot, "package.json"));
  const electronBinary = projectRequire("electron");
  if (typeof electronBinary !== "string")
    throw new Error("The Electron package did not resolve to an executable path.");
  return electronBinary;
}

class ElectronSession {
  private readonly _child: ChildProcess;
  private readonly _termination: Promise<ProcessTermination>;
  private _closePromise: Promise<void> | undefined;
  private _terminated = false;

  public constructor(
    projectRoot: string,
    sessionEntryPath: string,
    private readonly _configuration: ProviderSessionConfiguration,
    private readonly _processOptions: ElectronProcessOptions,
  ) {
    this._child = spawn(
      resolveElectronBinary(projectRoot, _processOptions.electronBinary),
      [...(_processOptions.electronArgs ?? []), sessionEntryPath],
      {
        cwd: projectRoot,
        env: {
          ...process.env,
          [SESSION_CONFIGURATION_ENV]: JSON.stringify(_configuration),
        },
        stdio: ["ignore", "inherit", "inherit", "ipc"],
        detached: process.platform !== "win32",
      },
    );

    this._termination = new Promise<ProcessTermination>((resolve) => {
      let processError: Error | undefined;
      this._child.once("error", (error) => processError = error);
      this._child.once("close", (code, signal) => {
        this._terminated = true;
        cleanupCacheDir(_configuration.cacheDir);
        resolve([code, signal, processError]);
      });
    });
  }

  public async start(timeoutMs: number): Promise<void> {
    let resolveReady: (() => void) | undefined;
    let rejectReady: ((error: Error) => void) | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const onMessage = (message: unknown) => {
      if (!isProviderSessionMessage(message) || message.sessionId !== this._configuration.sessionId)
        return;
      if (message.type === "ready")
        resolveReady?.();
      else
        rejectReady?.(new Error(`Electron provider session ${this._configuration.sessionId} failed: ${message.message}`));
    };

    this._child.on("message", onMessage);
    try {
      await Promise.race([
        ready,
        this._termination.then(([code, signal, processError]): never => {
          if (processError !== undefined)
            throw new Error(`Electron provider session ${this._configuration.sessionId} failed before ready: ${processError.message}`, { cause: processError });
          throw new Error(`Electron provider session ${this._configuration.sessionId} exited before ready: code=${code ?? "none"}, signal=${signal ?? "none"}`);
        }),
        new Promise<never>((_resolve, reject) => {
          timeout = setTimeout(() => reject(new Error(
            `Timed out after ${timeoutMs}ms waiting for Electron provider session ${this._configuration.sessionId} to load ${this._configuration.url}`,
          )), timeoutMs);
        }),
      ]);
    } finally {
      this._child.off("message", onMessage);
      if (timeout !== undefined)
        clearTimeout(timeout);
    }
  }

  public async close(): Promise<void> {
    this._closePromise ??= this._close();
    try {
      await this._closePromise;
    } catch (error) {
      this._closePromise = undefined;
      throw error;
    }
  }

  private async _waitForTermination(timeoutMs: number): Promise<boolean> {
    if (this._terminated)
      return true;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this._termination.then(() => true),
        new Promise<boolean>((resolve) => {
          timeout = setTimeout(() => resolve(false), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== undefined)
        clearTimeout(timeout);
    }
  }

  private async _close(): Promise<void> {
    if (this._terminated)
      return;

    try {
      if (this._child.connected) {
        this._child.send({ type: "shutdown" }, (error) => {
          if (error !== null && !this._terminated)
            signalChildProcess(this._child, "SIGTERM");
        });
      } else
        signalChildProcess(this._child, "SIGTERM");
    } catch {
      signalChildProcess(this._child, "SIGTERM");
    }

    if (await this._waitForTermination(this._processOptions.closeTimeout ?? DEFAULT_CLOSE_TIMEOUT))
      return;

    signalChildProcess(this._child, "SIGTERM");
    if (await this._waitForTermination(FORCE_KILL_TIMEOUT))
      return;

    signalChildProcess(this._child, "SIGKILL");
    if (!await this._waitForTermination(FORCE_KILL_TIMEOUT))
      throw new Error(`Electron provider process ${this._child.pid ?? "unknown"} did not exit after SIGKILL.`);
  }
}

/** A Vitest 4 BrowserProvider that owns only Electron process and window lifecycle.
 * @internal
 */
export class ElectronBrowserProvider {
  public readonly name = "electron";
  public readonly supportsParallelism = false;

  private _session: ElectronSession | undefined;
  private _opening: Promise<void> | undefined;
  private _closing = false;

  public constructor(
    private readonly _project: ElectronProject,
    private readonly _options: ElectronProviderOptions,
    private readonly _sessionEntryPath: string,
    private readonly _processOptions: ElectronProcessOptions = {},
  ) {}

  public getCommandsContext(_sessionId: string): Record<string, unknown> {
    // This foundation deliberately exposes no locator, input, screenshot, or custom command API.
    return {};
  }

  public async openPage(sessionId: string, url: string, { parallel }: { parallel: boolean }): Promise<void> {
    if (parallel)
      throw new Error("The Electron BrowserProvider does not support parallel sessions.");
    if (this._closing)
      throw new Error("The Electron BrowserProvider is already closed.");
    if (this._opening !== undefined)
      throw new Error("The Electron BrowserProvider is already opening a session.");

    const opening = this._openPage(sessionId, url);
    this._opening = opening;
    try {
      await opening;
    } finally {
      if (this._opening === opening)
        this._opening = undefined;
    }
  }

  public async close(): Promise<void> {
    this._closing = true;
    const opening = this._opening;
    await this._closeCurrentSession();
    await opening?.catch(() => {});
  }

  private async _openPage(sessionId: string, url: string): Promise<void> {
    if (this._session !== undefined)
      await this._closeCurrentSession();
    if (this._closing)
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
      session = new ElectronSession(projectRoot, this._sessionEntryPath, configuration, this._processOptions);
    } catch (error) {
      cleanupCacheDir(cacheDir);
      throw error;
    }
    this._session = session;

    try {
      await session.start(this._processOptions.startupTimeout ?? DEFAULT_STARTUP_TIMEOUT);
      if (this._closing)
        throw new Error("The Electron BrowserProvider is closing.");
    } catch (error) {
      try {
        await this._closeCurrentSession();
      } catch (cleanupError) {
        console.error(`Failed to terminate Electron provider session ${sessionId}:`, cleanupError);
      }
      if (this._closing)
        throw new Error("The Electron BrowserProvider is closing.", { cause: error });
      throw error;
    }
  }

  private async _closeCurrentSession(): Promise<void> {
    const session = this._session;
    if (session === undefined)
      return;

    await session.close();
    if (this._session === session)
      this._session = undefined;
  }
}

/** Create the provider option consumed by Vitest 4's `browser.provider` configuration.
 * @internal
 */
export function createElectronBrowserProviderOption(
  options: ElectronProviderOptions,
  sessionEntryPath: string,
): ReturnType<typeof defineBrowserProvider> {
  return defineBrowserProvider<ElectronProviderOptions>({
    name: "electron",
    supportedBrowser: ["electron"],
    options,
    providerFactory: (project) => new ElectronBrowserProvider(project, options, sessionEntryPath),
  });
}
