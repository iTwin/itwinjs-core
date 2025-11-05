/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { assert } from "chai";
import { exec } from "child_process";
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
  const isXvfbRunning = await isXvfbProcessRunning();

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

  let sizeAndPos = ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  const expectedBounds = window.getBounds();
  assert(sizeAndPos?.width === expectedBounds.width);
  assert(sizeAndPos?.height === expectedBounds.height);
  assert(sizeAndPos?.x === expectedBounds.x);
  assert(sizeAndPos?.y === expectedBounds.y);

  let isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(isMaximized === window.isMaximized());

  window.maximize();
  if (isXvfbRunning)
    window.emit("maximize"); // "maximize" event is not emitted when running with xvfb (linux)
  else
    await BeDuration.wait(250); // "maximize" event is not always emitted immediately

  isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(isMaximized);

  window.unmaximize();
  if (isXvfbRunning)
    window.emit("unmaximize"); // "unmaximize" event is not emitted when running with xvfb (linux)
  else
    await BeDuration.wait(250); // "unmaximize" event is not always emitted immediately

  isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(isMaximized === false);

  const width = 250;
  const height = 251;
  window.setSize(width, height);
  await BeDuration.wait(250); // wait for new size to be saved to settings file
  sizeAndPos = ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  for (let i = 0; i < 20 && (sizeAndPos?.width !== width || sizeAndPos?.height !== height); ++i) {
    // Sometimes 250ms isn't enough, so keep trying for an additional 1 second (50ms * 20)
    await BeDuration.wait(50);
    sizeAndPos = ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  }
  assert(sizeAndPos?.width === width);
  assert(sizeAndPos?.height === height);

  const x = 50;
  const y = 75;
  window.setPosition(x, y);
  await BeDuration.wait(250); // wait for new position to be saved to settings file
  sizeAndPos = ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  for (let i = 0; i < 20 && (sizeAndPos?.x !== x || sizeAndPos?.y !== y); ++i) {
    // Sometimes 250ms isn't enough, so keep trying for an additional 1 second (50ms * 20)
    await BeDuration.wait(50);
    sizeAndPos = ElectronHost.getWindowSizeAndPositionSetting(storeWindowName);
  }
  assert(sizeAndPos?.x === x);
  assert(sizeAndPos?.y === y);
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

/**
 * Checks if `xvfb` is running on the machine.
 * @note `true` doesn't necessary mean that tests are using `xvfb`.
 */
async function isXvfbProcessRunning(): Promise<boolean> {
  if (process.platform !== "linux")
    return false;

  let doesXvfbProcessExists = false;
  const bashProcess = exec("pgrep xvfb", (_, stdout) => {
    const processNumber = Number(stdout);
    doesXvfbProcessExists = !isNaN(processNumber);
  });

  await new Promise((resolve) => bashProcess.on("close", resolve));
  return doesXvfbProcessExists;
}
