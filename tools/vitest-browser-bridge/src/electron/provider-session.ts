/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import { app, BrowserWindow, type BrowserWindowConstructorOptions, ipcMain } from "electron";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { clearBackendCallbacks } from "../callbacks/backend.js";
import {
  composeElectronPreloadSource,
  installElectronCallbackHandler,
} from "../callbacks/electron.js";

interface ProviderSessionEnvironment {
  readonly url: string;
  readonly sessionId: string;
  readonly cacheDir?: string;
  readonly backendInitModule?: string;
  readonly preloadModule?: string;
  readonly headless: boolean;
}

/** Create the security-sensitive BrowserWindow options used by every provider session.
 * @internal
 */
export function createProviderWindowOptions(preload: string, headless: boolean): BrowserWindowConstructorOptions {
  return {
    show: !headless,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
      // Vitest runs the tester in a same-origin iframe. The preload is needed in that iframe,
      // while node integration remains disabled in both the top frame and its subframes.
      nodeIntegrationInSubFrames: true,
      sandbox: false,
    },
  };
}

function readEnvironment(environment: NodeJS.ProcessEnv = process.env): ProviderSessionEnvironment {
  const url = environment.VITEST_BROWSER_BRIDGE_URL;
  if (typeof url !== "string" || url.length === 0)
    throw new Error("Missing VITEST_BROWSER_BRIDGE_URL.");

  return {
    url,
    sessionId: environment.VITEST_BROWSER_BRIDGE_SESSION_ID ?? `pid-${process.pid}`,
    cacheDir: environment.VITEST_BROWSER_BRIDGE_CACHE_DIR,
    backendInitModule: environment.VITEST_BROWSER_BRIDGE_BACKEND_INIT,
    preloadModule: environment.VITEST_BROWSER_BRIDGE_PRELOAD,
    headless: environment.VITEST_BROWSER_BRIDGE_HEADLESS !== "false",
  };
}

function writePreloadFile(environment: ProviderSessionEnvironment, token: string): string {
  const directory = environment.cacheDir ?? path.join(process.cwd(), ".vitest-browser-bridge");
  fs.mkdirSync(directory, { recursive: true });
  const preloadPath = path.join(directory, `preload-${environment.sessionId}.cjs`);
  fs.writeFileSync(preloadPath, composeElectronPreloadSource({
    token,
    userPreloadModule: environment.preloadModule,
  }), "utf8");
  return preloadPath;
}

async function loadBackendInit(modulePath: string | undefined): Promise<void> {
  if (modulePath === undefined)
    return;

  // Backend init modules are compiled by the consuming package and intentionally run in the
  // Electron main process, not in the Vitest renderer and not through a production RPC layer.
  const loaded = require(modulePath) as unknown;
  const initializer = typeof loaded === "object" && loaded !== null && "default" in loaded
    ? (loaded as { default?: unknown }).default
    : loaded;
  if (typeof initializer === "function")
    await initializer();
  else if (initializer !== undefined && initializer !== null && typeof (initializer as PromiseLike<unknown>).then === "function")
    await Promise.resolve(initializer);
}

/** Run one provider-owned Electron main process. This function never collects or executes tests.
 * @internal
 */
export async function runProviderSession(environment = readEnvironment()): Promise<void> {
  const token = crypto.randomUUID();
  if (environment.cacheDir !== undefined)
    app.setPath("userData", path.join(environment.cacheDir, "electron-user-data"));

  await app.whenReady();
  clearBackendCallbacks();
  await loadBackendInit(environment.backendInitModule);

  const disposeCallbacks = installElectronCallbackHandler(ipcMain, token);
  const preload = writePreloadFile(environment, token);
  const window = new BrowserWindow(createProviderWindowOptions(preload, environment.headless));
  let exitCode = 0;
  let settled = false;
  let resolveShutdown: (() => void) | undefined;

  const finish = (code: number) => {
    if (settled)
      return;
    exitCode = code;
    settled = true;
    resolveShutdown?.();
  };
  const onSignal = () => finish(0);
  const onWindowClosed = () => finish(exitCode);
  const onRenderGone = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
    console.error(`[vitest-browser-bridge:${environment.sessionId}] renderer exited: ${details.reason}`);
    finish(1);
  };

  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  window.once("closed", onWindowClosed);
  window.webContents.once("render-process-gone", onRenderGone);

  try {
    await window.loadURL(environment.url);
    console.log(`[vitest-browser-bridge:${environment.sessionId}] ready`);
    await new Promise<void>((resolve) => {
      resolveShutdown = resolve;
      if (settled)
        resolve();
    });
  } finally {
    process.off("SIGTERM", onSignal);
    process.off("SIGINT", onSignal);
    disposeCallbacks();
    if (!window.isDestroyed())
      window.destroy();
    clearBackendCallbacks();
    if (app.isReady())
      app.exit(exitCode);
    try {
      fs.rmSync(preload, { force: true });
    } catch {
      // The cache directory is already owned by the provider for best-effort cleanup.
    }
  }

  if (exitCode !== 0)
    throw new Error(`Electron provider session ${environment.sessionId} exited with code ${exitCode}.`);
}

// Electron evaluates the application entry with `require.main` set to its own bootstrap module,
// so process.type is the reliable distinction from Node-side unit-test imports.
if (process.type === "browser") {
  runProviderSession().catch((error: unknown) => {
    console.error("Electron provider session failed:", error);
    app.exit(1);
  });
}
