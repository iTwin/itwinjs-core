/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import { installElectronFrameRouting } from "@itwin/vitest-browser-bridge/electron/frame-routing";

it("routes IPC-only notifications from handlers registered during backend startup", async () => {
  let started = false;
  const sendToTopFrame = vi.fn();
  const webContents = { send: sendToTopFrame, sendToFrame: vi.fn() };
  type Listener = (event: { sender: typeof webContents, frameId: number }) => unknown;
  const handlers = new Map<string, Listener>();
  const ipcMain = { handle: (channel: string, listener: Listener) => handlers.set(channel, listener), on: vi.fn() };
  const electronHost = {
    get ipcMain() { return started ? ipcMain : undefined; },
    // eslint-disable-next-line @typescript-eslint/naming-convention
    get electron() { return started ? { BrowserWindow: { getAllWindows: () => [{ webContents }] } } : undefined; },
  };
  const backendModule = { exports: undefined as unknown };
  // Load the built CommonJS entry point so its actual require order is exercised.
  runInNewContext(readFileSync(resolve(__dirname, "../../lib/backend/vitest-electron.js"), "utf8"), {
    module: backendModule,
    exports: {},
    process: { env: {} },
    require: (name: string): unknown => {
      if (name === "electron")
        return { ipcMain };
      if (name === "@itwin/vitest-browser-bridge/electron/frame-routing")
        return { installElectronFrameRouting };
      if (name === "@itwin/core-electron/main")
        return { ElectronHost: electronHost }; // eslint-disable-line @typescript-eslint/naming-convention
      if (name === "./backend") {
        started = true;
        ipcMain.handle("ipc-only", () => webContents.send("notification"));
        return Promise.resolve();
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  await backendModule.exports;
  await handlers.get("ipc-only")!({ sender: webContents, frameId: 42 });
  expect(webContents.sendToFrame).toHaveBeenCalledExactlyOnceWith(42, "notification");
  expect(sendToTopFrame).not.toHaveBeenCalled();
});
