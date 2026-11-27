/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { expect, it, vi } from "vitest";
import type { runProviderSession } from "../electron/provider-session.js";

it.each([{ shutdownFirst: false, code: 1 }, { shutdownFirst: true, code: 0 }])(
  "returns $code when the window closes (shutdown requested: $shutdownFirst)", async ({ shutdownFirst, code }) => {
    const window = Object.assign(new EventEmitter(), {
      webContents: Object.assign(new EventEmitter(), { id: 42 }),
      loadURL: async () => {},
      isDestroyed: () => true,
    });
    const child = Object.assign(new EventEmitter(), {
      connected: true,
      send: (message: { type: string }): void => {
        if (message.type === "ready") {
          if (shutdownFirst)
            child.emit("message", { type: "shutdown" });
          window.emit("closed");
        }
      },
    });
    const electron = {
      app: { setPath: vi.fn(), whenReady: async () => {} },
      BrowserWindow: vi.fn(function () { return window; }), // eslint-disable-line @typescript-eslint/naming-convention
      ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
      session: { defaultSession: { registerPreloadScript: () => "preload", unregisterPreloadScript: vi.fn() } },
    };
    const entry = resolve("lib/cjs/electron/provider-session.js");
    const require = createRequire(entry);
    const exports = {} as { runProviderSession: typeof runProviderSession };
    // Exercise the built session with isolated process/window events, without starting Electron.
    runInNewContext(readFileSync(entry, "utf8"), {
      exports, process: child, console: { error: vi.fn() },
      __dirname: dirname(entry), // eslint-disable-line @typescript-eslint/naming-convention
      require: (name: string) => name === "electron" ? electron : require(name),
    });
    await expect(exports.runProviderSession({ sessionId: "close-order", url: "about:blank", cacheDir: "/tmp/close-order", headless: true })).resolves.toBe(code);
  },
);
