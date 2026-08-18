/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import {
  app,
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  ipcMain,
  session,
  type Session,
} from "electron";
import * as path from "node:path";
import { clearBackendCallbacks } from "../callbacks/backend.js";
import { installElectronCallbackHandler } from "../callbacks/electron.js";
import {
  isSessionShutdownMessage,
  parseProviderSessionConfiguration,
  type ProviderSessionConfiguration,
  type ProviderSessionMessage,
  SESSION_CONFIGURATION_ENV,
} from "./session-protocol.js";

/** Create the security-sensitive BrowserWindow options used by every provider session.
 * @internal
 */
export function createProviderWindowOptions(preload: string | undefined, headless: boolean): BrowserWindowConstructorOptions {
  return {
    show: !headless,
    webPreferences: {
      ...(preload === undefined ? {} : { preload }),
      contextIsolation: true,
      nodeIntegration: false,
      // Vitest runs the tester in a same-origin iframe. The consumer preload is needed in that
      // iframe, while node integration remains disabled in both page worlds.
      nodeIntegrationInSubFrames: true,
      sandbox: false,
    },
  };
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

function sendToProvider(message: ProviderSessionMessage): void {
  try {
    process.send?.(message, () => {});
  } catch {
    // The provider may already have disconnected while Electron was shutting down.
  }
}

function exitProviderProcess(exitCode: number): void {
  process.disconnect?.();
  app.exit(exitCode);
  // Electron can leave its native process alive after app.exit(); session teardown has already
  // released the window, IPC handler, and preload registration, so terminate the main process.
  process.kill(process.pid, "SIGTERM");
}

/** Run one provider-owned Electron main process. This function never collects or executes tests.
 * @internal
 */
export async function runProviderSession(environment: ProviderSessionConfiguration): Promise<number> {
  app.setPath("userData", path.join(environment.cacheDir, "electron-user-data"));

  let browserSession: Session | undefined;
  let bridgePreloadId: string | undefined;
  let disposeCallbacks: (() => void) | undefined;
  let window: BrowserWindow | undefined;
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
  const onProviderMessage = (message: unknown) => {
    if (isSessionShutdownMessage(message))
      finish(0);
  };
  const onWindowClosed = () => finish(exitCode);
  const onRenderGone = (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
    console.error(`[vitest-browser-bridge:${environment.sessionId}] renderer exited: ${details.reason}`);
    finish(1);
  };

  try {
    await app.whenReady();
    clearBackendCallbacks();
    await loadBackendInit(environment.backendInitModule);

    browserSession = session.defaultSession;
    bridgePreloadId = browserSession.registerPreloadScript({
      type: "frame",
      filePath: path.join(__dirname, "bridge-preload.js"),
    });

    window = new BrowserWindow(createProviderWindowOptions(environment.preloadModule, environment.headless));
    disposeCallbacks = installElectronCallbackHandler(ipcMain, window.webContents.id);

    process.once("SIGTERM", onSignal);
    process.once("SIGINT", onSignal);
    process.on("message", onProviderMessage);
    window.once("closed", onWindowClosed);
    window.webContents.once("render-process-gone", onRenderGone);

    await window.loadURL(environment.url);
    sendToProvider({ type: "ready", sessionId: environment.sessionId });
    await new Promise<void>((resolve) => {
      resolveShutdown = resolve;
      if (settled)
        resolve();
    });
    return exitCode;
  } finally {
    process.off("SIGTERM", onSignal);
    process.off("SIGINT", onSignal);
    process.off("message", onProviderMessage);
    disposeCallbacks?.();
    if (window !== undefined) {
      window.off("closed", onWindowClosed);
      window.webContents.off("render-process-gone", onRenderGone);
      if (!window.isDestroyed())
        window.destroy();
    }
    if (browserSession !== undefined && bridgePreloadId !== undefined)
      browserSession.unregisterPreloadScript(bridgePreloadId);
    clearBackendCallbacks();
  }
}

async function startProviderSession(): Promise<void> {
  let environment: ProviderSessionConfiguration | undefined;
  try {
    environment = parseProviderSessionConfiguration(process.env[SESSION_CONFIGURATION_ENV]);
    const exitCode = await runProviderSession(environment);
    exitProviderProcess(exitCode);
  } catch (error) {
    if (environment !== undefined) {
      sendToProvider({
        type: "failure",
        sessionId: environment.sessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    console.error("Electron provider session failed:", error);
    exitProviderProcess(1);
  }
}

// Electron evaluates the application entry with `require.main` set to its own bootstrap module,
// so process.type is the reliable distinction from Node-side unit-test imports.
if (process.type === "browser")
  void startProviderSession();
