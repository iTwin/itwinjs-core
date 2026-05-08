/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { type ChildProcess, spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createRequire } from "node:module";
import { playwright as PlaywrightBrowserProvider } from "@vitest/browser/providers";
import type { BrowserProviderInitializationOptions, TestProject } from "vitest/node";
import type { ElectronBrowserProviderOptions } from "./types.js";

const playwrightBrowserProviderBase: any = PlaywrightBrowserProvider;
const moduleRequire = createRequire(path.join(process.cwd(), "package.json"));

interface ElectronSession {
  process: ChildProcess;
  cacheDir: string;
}

/** Resolve the Electron provider main-process entry point from this package's compiled CJS output. */
function getProviderSessionEntryPath(): string {
  const providerEntry = moduleRequire.resolve("@itwin/vitest-certa-bridge/electron-provider");
  const pkgRoot = path.resolve(path.dirname(providerEntry), "../../..");
  return path.join(pkgRoot, "lib", "cjs", "electron", "provider-session.js");
}

function cleanupCacheDir(cacheDir: string) {
  try {
    fs.rmSync(cacheDir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup only.
  }
}

async function waitForExit(child: ChildProcess, timeoutMs: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null)
    return;

  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled)
        return;
      settled = true;
      clearTimeout(killTimeout);
      clearTimeout(giveUpTimeout);
      resolve();
    };

    const killTimeout = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Best effort. The process may have already exited or the platform may not support SIGKILL.
      }
    }, timeoutMs);

    const giveUpTimeout = setTimeout(finish, timeoutMs + 2000);
    child.once("exit", finish);
  });
}

/**
 * Vitest BrowserProvider that executes browser-mode tests inside an Electron BrowserWindow.
 *
 * Vitest owns test collection/execution/reporting; this provider only owns Electron process
 * lifecycle, secure BrowserWindow setup, optional backend initialization, and preload-backed
 * callback transport.
 *
 * This first milestone intentionally supports renderer execution, not full browser automation
 * commands. Provider-specific command APIs such as screenshots, locators, keyboard/mouse input,
 * and parallel sessions should be added with dedicated consumer need and coverage.
 *
 * @beta
 */
export default class ElectronBrowserProvider extends playwrightBrowserProviderBase {
  public readonly name = "electron";
  public readonly supportsParallelism = false;

  private _project?: TestProject;
  private _options: ElectronBrowserProviderOptions = {};
  private readonly _sessions = new Map<string, ElectronSession>();

  public getSupportedBrowsers(): readonly string[] {
    return ["electron"];
  }

  public initialize(project: TestProject, { options }: BrowserProviderInitializationOptions): void {
    this._project = project;
    this._options = options ?? {};
  }

  public getCommandsContext(_sessionId: string): Record<string, unknown> {
    // Electron-specific browser commands can be added later. Keep this intentionally empty for
    // the first native-provider milestone so tests prove standard Vitest browser APIs first.
    return {};
  }

  public getPage(_sessionId: string): { keyboard: { up: (key: string) => Promise<void> } } {
    // Vitest 3.0.6's browser cleanup path special-cases built-in providers and calls the
    // Playwright `page.keyboard.up` API even when no keys were pressed. Extending the
    // Playwright provider and returning this minimal keyboard shape keeps cleanup working
    // without claiming full Playwright command support for Electron yet.
    return { keyboard: { up: async () => {} } };
  }

  public async openPage(sessionId: string, url: string, beforeNavigate?: () => Promise<void>): Promise<void> {
    if (!this._project)
      throw new Error("ElectronBrowserProvider was used before initialize().");

    await beforeNavigate?.();

    const existing = this._sessions.get(sessionId);
    if (existing) {
      existing.process.kill();
      cleanupCacheDir(existing.cacheDir);
      this._sessions.delete(sessionId);
    }

    const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), `vitest-electron-${sessionId}-`));
    const electronBin = moduleRequire("electron/index.js") as string;
    const sessionEntry = getProviderSessionEntryPath();
    const electronArgs = [...(this._options.electronArgs ?? []), sessionEntry];

    const env: Record<string, string> = {
      ...process.env,
      ...(this._options.env ?? {}),
      // eslint-disable-next-line @typescript-eslint/naming-convention
      VITEST_ELECTRON_URL: url,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      VITEST_ELECTRON_SESSION_ID: sessionId,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      VITEST_ELECTRON_CACHE_DIR: cacheDir,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ELECTRON_CACHE_DIR: cacheDir,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      VITEST_ELECTRON_HEADLESS: String(this._project.config.browser.headless !== false),
    };

    if (this._options.backendInitModule)
      env.CERTA_BRIDGE_BACKEND_INIT = this._options.backendInitModule;
    if (this._options.preloadModule)
      env.ELECTRON_PRELOAD_MODULE = this._options.preloadModule;
    if (this._options.timeout)
      env.VITEST_ELECTRON_TIMEOUT = String(this._options.timeout);

    const electronProcess = spawn(electronBin, electronArgs, {
      cwd: this._project.config.root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this._sessions.set(sessionId, { process: electronProcess, cacheDir });

    await new Promise<void>((resolve, reject) => {
      const timeoutMs = this._options.timeout ?? 600000;
      let settled = false;
      let stdout = "";

      const cleanup = () => clearTimeout(timeout);
      const settleResolve = () => {
        if (settled)
          return;
        settled = true;
        cleanup();
        resolve();
      };
      const settleReject = (err: Error) => {
        if (settled)
          return;
        settled = true;
        cleanup();
        if (!electronProcess.killed)
          electronProcess.kill();
        reject(err);
      };

      const timeout = setTimeout(() => {
        settleReject(new Error(`Timed out waiting ${timeoutMs}ms for Electron provider session ${sessionId} to load ${url}`));
      }, timeoutMs);

      electronProcess.stdout.on("data", (chunk: Buffer) => {
        const text = chunk.toString();
        process.stdout.write(text);
        stdout += text;
        if (stdout.includes(`[vitest-electron-provider:${sessionId}] ready`))
          settleResolve();
      });

      electronProcess.stderr.on("data", (chunk: Buffer) => {
        process.stderr.write(chunk);
      });

      electronProcess.on("error", (err) => {
        settleReject(err);
      });

      electronProcess.on("exit", (code, signal) => {
        this._sessions.delete(sessionId);
        cleanupCacheDir(cacheDir);
        if (!settled)
          settleReject(new Error(`Electron provider session ${sessionId} exited before becoming ready: code=${code ?? "none"}, signal=${signal ?? "none"}`));
      });
    });
  }

  public async close(): Promise<void> {
    await Promise.all([...this._sessions.values()].map(async ({ process: child, cacheDir }) => {
      if (child.exitCode === null && child.signalCode === null)
        child.kill();
      await waitForExit(child, 5000);
      cleanupCacheDir(cacheDir);
    }));
    this._sessions.clear();
  }
}
