/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { BrowserWindow } from "electron";
import * as path from "path";
import { assert } from "chai";
import { IModelHost, IpcHandler, NativeHost } from "@itwin/core-backend";
import { BeDuration } from "@itwin/core-bentley";
import { RpcInterface, RpcRegistry } from "@itwin/core-common";
import { ElectronHost, ElectronHostOptions } from "../../ElectronBackend";
import { TestSuite } from "./ElectronBackendTests";

export const electronHostTestSuite: TestSuite = {
  title: "ElectronHost tests.",
  tests: [
    {
      title: "Should start without options.",
      func: testStartWithoutOptions,
    },
    {
      title: "Should start with options.",
      func: testStartWithOptions,
    },
    {
      title: "Should register IPC handler.",
      func: testRegisterIpcHandler,
    },
    {
      title: "Should initialize provided RPC interface.",
      func: testInitializeProvidedRpcInterface,
    },
    {
      title: "Should open main window.",
      func: testOpenMainWindow,
    },
    {
      title: "Should open provided Web URL in main window.",
      func: testMainWindowOpenedWithWebUrl,
    },
    {
      title: "Should open local index.html in main window.",
      func: testMainWindowOpenedWithLocalFile,
    },
    {
      title: "Should save main window size, position and maximized flag.",
      func: testWindowSizeSettings,
    },
  ],
};

async function testStartWithoutOptions() {
  assertElectronHostNotInitialized();
  await ElectronHost.startup();
  assertElectronHostIsInitialized();
}

async function testStartWithOptions() {
  assertElectronHostNotInitialized();

  const options: ElectronHostOptions = {
    webResourcesPath: path.join("not", "a", "real", "path"),
    iconName: "notARealFile.ico",
  };
  await ElectronHost.startup({ electronHost: options });

  assertElectronHostIsInitialized();

  // If relative path doesn't exist (is empty), paths are the same.
  let relativePath = path.relative(ElectronHost.webResourcesPath, options.webResourcesPath!);
  assert(relativePath.length === 0);
  relativePath = path.relative(ElectronHost.appIconPath, path.join(options.webResourcesPath!, options.iconName!));
  assert(relativePath.length === 0);
}

async function testRegisterIpcHandler() {
  class IpcHandlerMock extends IpcHandler {
    public override get channelName() { return "electron-test/mock-channel"; }
    public static wasRegisterCalled = false;

    public static override register() {
      IpcHandlerMock.wasRegisterCalled = true;
      return () => undefined;
    }
  }

  await ElectronHost.startup({
    electronHost: {
      ipcHandlers: [IpcHandlerMock],
    },
  });

  assert(IpcHandlerMock.wasRegisterCalled);
}

async function testInitializeProvidedRpcInterface() {
  abstract class TestRpcInterface extends RpcInterface {
    public static readonly interfaceName = "TestRpcInterface";
    public static interfaceVersion = "0.0.0";
  }

  await ElectronHost.startup({
    electronHost: {
      rpcInterfaces: [TestRpcInterface],
    },
  });

  assert(RpcRegistry.instance.definitionClasses.has(TestRpcInterface.interfaceName));
}

async function testOpenMainWindow() {
  await ElectronHost.startup();
  const electron = ElectronHost.electron;

  let windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 0);

  await ElectronHost.openMainWindow();

  windows = electron.BrowserWindow.getAllWindows();
  assert(windows.length === 1);
  assert(ElectronHost.mainWindow?.id === windows[0].id);
}

async function testMainWindowOpenedWithWebUrl() {
  const url = "https://www.itwinjs.org/";

  await ElectronHost.startup({
    electronHost: {
      frontendURL: url,
    },
  });
  await ElectronHost.openMainWindow();

  const window = ElectronHost.electron.BrowserWindow.getAllWindows()[0];
  assert(window !== undefined);

  await new Promise((resolve) => window.webContents.once("did-finish-load", () => resolve(undefined)));
  assert(url === window.webContents.getURL());

  const html: string = await window.webContents.executeJavaScript('document.documentElement.outerHTML');
  assert(html.includes("iTwin.js"));
}

async function testMainWindowOpenedWithLocalFile() {
  await ElectronHost.startup({
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "assets"),
    },
  });

  await ElectronHost.openMainWindow();

  assert(ElectronHost.electron.protocol.isProtocolHandled("electron"));
  assert(ElectronHost.mainWindow !== undefined);

  const window = ElectronHost.mainWindow;
  await new Promise((resolve) => window.webContents.once("did-finish-load", () => resolve(undefined)));

  const url = window.webContents.getURL();
  assert(url.startsWith("electron://"));
  assert(url.endsWith("index.html"));

  const html: string = await window.webContents.executeJavaScript('document.documentElement.outerHTML');
  assert(html.includes("Electron test window"));
}

async function testWindowSizeSettings() {
  const storeWindowName = "settingsTestWindow";

  await ElectronHost.startup({
    electronHost: {
      webResourcesPath: path.join(__dirname, "..", "assets"),
    },
  });

  NativeHost.settingsStore.removeData(`windowMaximized-${storeWindowName}`);
  NativeHost.settingsStore.removeData(`windowSizeAndPos-${storeWindowName}`);

  await ElectronHost.openMainWindow({ storeWindowName });

  const window = ElectronHost.mainWindow;
  assert(window);

  const savedSizeAndPos = () => ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  const savedMaximized = () => ElectronHost.getWindowMaximizedSetting(storeWindowName);

  const expectedBounds = window.getBounds();
  assert(savedSizeAndPos()?.width === expectedBounds.width);
  assert(savedSizeAndPos()?.height === expectedBounds.height);
  assert(savedSizeAndPos()?.x === expectedBounds.x);
  assert(savedSizeAndPos()?.y === expectedBounds.y);

  assert(savedMaximized() === window.isMaximized());

  // The saved flag must converge on the window's actual state. Whether the window really maximizes,
  // and whether "maximize"/"unmaximize" are delivered at all, is up to the platform's window manager.
  window.maximize();
  assert(await waitUntil(() => savedMaximized() === window.isMaximized()));

  window.unmaximize();
  assert(await waitUntil(() => savedMaximized() === window.isMaximized()));

  // Windows restores from maximized asynchronously. A resize issued before that settles is overwritten
  // when the restored bounds arrive and win the last debounced write.
  await waitForStableBounds(window);

  // A fractionally-scaled display rounds through physical pixels, so the realized bounds can differ from
  // the requested bounds by a pixel or two. What must hold is that the saved state converges on whatever
  // the window actually reports.
  const savedMatchesWindow = () => {
    const saved = savedSizeAndPos();
    const bounds = window.getBounds();
    return saved !== undefined && saved.width === bounds.width && saved.height === bounds.height
      && saved.x === bounds.x && saved.y === bounds.y;
  };

  const boundsBeforeResize = window.getBounds();
  const targetWidth = boundsBeforeResize.width === 250 ? 300 : 250;
  const targetHeight = boundsBeforeResize.height === 251 ? 301 : 251;
  window.setSize(targetWidth, targetHeight);
  assert(await waitUntil(() => {
    const bounds = window.getBounds();
    return bounds.width !== boundsBeforeResize.width || bounds.height !== boundsBeforeResize.height;
  }));
  assert(await waitUntil(savedMatchesWindow));

  const boundsBeforeMove = window.getBounds();
  // The OS chooses the initial position, so pick a target it can't already be at - otherwise setPosition
  // is a no-op and the "window changed" assertion below can never be satisfied.
  const targetX = boundsBeforeMove.x === 50 ? 100 : 50;
  const targetY = boundsBeforeMove.y === 75 ? 150 : 75;
  window.setPosition(targetX, targetY);
  assert(await waitUntil(() => {
    const bounds = window.getBounds();
    return bounds.x !== boundsBeforeMove.x || bounds.y !== boundsBeforeMove.y;
  }));
  assert(await waitUntil(savedMatchesWindow));
}

/** Longer than `ElectronHost`'s 200ms window state debounce, so a stable sample means nothing is pending. */
const settleInterval = BeDuration.fromMilliseconds(400);

/**
 * Polls `condition` until it holds, for up to ~5 seconds.
 * @note `ElectronHost` persists window state from a debounced handler, so the settings file lags the window.
 */
async function waitUntil(condition: () => boolean): Promise<boolean> {
  for (let i = 0; i < 100 && !condition(); ++i)
    await BeDuration.wait(50);

  return condition();
}

/** Waits until the window reports the same bounds across a full settle interval, throwing if it doesn't within ~4 seconds. */
async function waitForStableBounds(window: BrowserWindow): Promise<void> {
  let previous = "";
  for (let i = 0; i < 10; ++i) {
    const current = JSON.stringify(window.getBounds());
    if (current === previous)
      return;

    previous = current;
    await settleInterval.wait();
  }

  throw new Error("Window bounds did not stabilize");
}

function assertElectronHostNotInitialized() {
  assert(!ElectronHost.isValid);
  assert(!NativeHost.isValid);
  assert(!IModelHost.isValid);
  assert(ElectronHost.electron === undefined);
  assert(ElectronHost.app === undefined);
  assert(ElectronHost.ipcMain === undefined);
  assert(ElectronHost.rpcConfig === undefined);
  assert(ElectronHost.webResourcesPath === undefined);
  assert(ElectronHost.appIconPath === undefined);
  assert(ElectronHost.frontendURL === undefined);
}

function assertElectronHostIsInitialized() {
  assert(ElectronHost.isValid);
  assert(NativeHost.isValid);
  assert(IModelHost.isValid);
  assert(ElectronHost.electron !== undefined);
  assert(ElectronHost.app !== undefined);
  assert(ElectronHost.ipcMain !== undefined);
  assert(ElectronHost.rpcConfig !== undefined);
  assert(typeof ElectronHost.webResourcesPath === "string");
  assert(typeof ElectronHost.appIconPath === "string");
  assert(typeof ElectronHost.frontendURL === "string");
}
