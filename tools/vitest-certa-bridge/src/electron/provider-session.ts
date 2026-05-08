/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

// Electron main-process entry used by the Vitest BrowserProvider implementation.
// It intentionally does not collect or run tests. Vitest browser mode owns test execution;
// this process only creates a secure BrowserWindow and navigates it to Vitest's session URL.

import { app, BrowserWindow, ipcMain } from "electron";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import { clearCallbacks, dispatchCallback } from "../callbackRegistry.js";

process.stdout.on("error", () => {});
process.stderr.on("error", () => {});

const vitestUrl = process.env.VITEST_ELECTRON_URL;
const sessionId = process.env.VITEST_ELECTRON_SESSION_ID ?? `pid-${process.pid}`;
const cacheDir = process.env.VITEST_ELECTRON_CACHE_DIR;
const backendInitModule = process.env.CERTA_BRIDGE_BACKEND_INIT;
const userPreloadModule = process.env.ELECTRON_PRELOAD_MODULE;
const timeout = Number(process.env.VITEST_ELECTRON_TIMEOUT ?? "600000");
const headless = process.env.VITEST_ELECTRON_HEADLESS !== "false";

if (!vitestUrl) {
  console.error("Missing required env var: VITEST_ELECTRON_URL");
  process.exit(1);
}
const _vitestUrl: string = vitestUrl;

const bridgeToken = crypto.randomUUID();

if (cacheDir)
  app.setPath("userData", path.join(cacheDir, "electron-user-data"));

if (typeof (globalThis as any).crypto === "undefined")
  (globalThis as any).crypto = crypto.webcrypto;

if (process.platform === "linux")
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");

function shutdownProviderSession() {
  clearCallbacks();
  for (const win of BrowserWindow.getAllWindows())
    win.destroy();
  if (app.isReady())
    app.quit();
}

process.once("SIGTERM", shutdownProviderSession);
process.once("SIGINT", shutdownProviderSession);

function writeProviderPreload(): string {
  const preloadDir = cacheDir ?? path.join(process.cwd(), ".tmp");
  fs.mkdirSync(preloadDir, { recursive: true });
  const preloadPath = path.join(preloadDir, `vitest-electron-provider-preload-${sessionId}.js`);

  const preloadSource = `
    const { contextBridge, ipcRenderer } = require("electron");

    ${userPreloadModule ? `require(${JSON.stringify(userPreloadModule)});` : ""}

    contextBridge.exposeInMainWorld("_CertaSendToBackend", async (name, args) => {
      const response = await ipcRenderer.invoke("certa-callback", {
        token: ${JSON.stringify(bridgeToken)},
        name,
        args,
      });
      if (response && response.error) {
        const err = new Error(response.error.message);
        err.stack = response.error.stack;
        throw err;
      }
      return response ? response.result : undefined;
    });
  `;

  fs.writeFileSync(preloadPath, preloadSource, "utf8");
  return preloadPath;
}

async function loadBackendInit() {
  if (!backendInitModule)
    return;

  const backendMod = require(backendInitModule);
  const backendInit = backendMod?.default ?? backendMod;
  if (typeof backendInit === "function")
    await backendInit();
  else if (backendInit && typeof backendInit.then === "function")
    await backendInit;
}

function parseCallbackPayload(payload: unknown): { token: string; name: string; args: any[] } {
  if (!payload || typeof payload !== "object")
    throw new Error("Invalid backend callback payload.");

  const candidate = payload as { token?: unknown; name?: unknown; args?: unknown };
  if (typeof candidate.token !== "string" || typeof candidate.name !== "string" || !Array.isArray(candidate.args))
    throw new Error("Invalid backend callback payload.");

  return { token: candidate.token, name: candidate.name, args: candidate.args };
}

function isViteClientLifecycleMessage(message: string): boolean {
  return message === "[vite] connecting..."
    || message === "[vite] connected."
    || message === "[vite] server connection lost. Polling for restart...";
}

async function main() {
  await app.whenReady();

  // Each provider session is a short-lived Electron main process, but clear explicitly so
  // backend callbacks cannot leak if a future provider mode reuses the process.
  clearCallbacks();
  app.once("will-quit", clearCallbacks);
  process.once("exit", clearCallbacks);

  await loadBackendInit();

  ipcMain.handle("certa-callback", async (_event, payload: unknown) => {
    try {
      const { token, name, args } = parseCallbackPayload(payload);
      const result = await dispatchCallback(name, args, token, bridgeToken);
      return { result };
    } catch (err: any) {
      return { error: { message: err.message, stack: err.stack } };
    }
  });

  const preload = writeProviderPreload();
  const win = new BrowserWindow({
    show: !headless,
    webPreferences: {
      preload,
      nodeIntegration: false,
      // Vitest browser mode executes tests inside a same-origin tester iframe. Electron only
      // loads preload scripts into that iframe when this option is enabled; nodeIntegration
      // itself remains disabled above, so tests still rely on contextBridge-exposed APIs.
      nodeIntegrationInSubFrames: true,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const label = `[vitest-electron-provider:${sessionId}]`;

  win.webContents.on("console-message", (details: Electron.Event<Electron.WebContentsConsoleMessageEventParams>) => {
    const { level, message } = details;
    // Vitest browser mode runs through Vite's dev client. Its websocket lifecycle messages are
    // expected during startup/shutdown and are not test output; forwarding them makes clean runs
    // look like they have post-test failures.
    if (isViteClientLifecycleMessage(message))
      return;

    if (level === "error" || level === "warning") process.stderr.write(`${label} ${message}\n`);
    else process.stdout.write(`${label} ${message}\n`);
  });

  win.once("closed", clearCallbacks);

  win.webContents.on("render-process-gone", (_event: Electron.Event, details: Electron.RenderProcessGoneDetails) => {
    clearCallbacks();
    console.error(`${label} Renderer process gone: reason=${details.reason}, exitCode=${details.exitCode}`);
    process.exit(1);
  });

  await win.loadURL(_vitestUrl);
  console.log(`${label} ready`);

  setTimeout(() => {
    console.error(`${label} timed out after ${timeout}ms`);
    process.exit(1);
  }, timeout).unref();
}

main().catch((err) => {
  console.error("Electron provider main process error:", err);
  process.exit(1);
});
