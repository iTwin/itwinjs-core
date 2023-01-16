/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import * as path from "path";
import { assert } from "chai";
import { IModelHost, IpcHandler, NativeHost } from "@itwin/core-backend";
import { IModelReadRpcInterface, IModelTileRpcInterface, RpcInterface, RpcRegistry, SnapshotIModelRpcInterface } from "@itwin/core-common";
import { PresentationRpcInterface } from "@itwin/presentation-common";
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
      title: "Should initialize default RPC interface.",
      func: testInitializeDefaultRpcInterface,
    },
    {
      title: "Should open main window.",
      func: testOpenMainWindow,
    },
    {
      title: "Should open provided URL in main window.",
      func: testMainWindowUrl,
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
    public override get channelName() { return "IpcHandlerMock-channel"; }
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

async function testInitializeDefaultRpcInterface() {
  const defaultInterfaces = [
    IModelReadRpcInterface,
    IModelTileRpcInterface,
    SnapshotIModelRpcInterface,
    PresentationRpcInterface,
  ];

  await ElectronHost.startup();

  for (const interfaceDef of defaultInterfaces)
    assert(RpcRegistry.instance.definitionClasses.has(interfaceDef.interfaceName));
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

async function testMainWindowUrl() {
  const url = "https://www.itwinjs.org/";

  await ElectronHost.startup({
    electronHost: {
      frontendURL: url,
    },
  });
  await ElectronHost.openMainWindow();

  const window = ElectronHost.electron.BrowserWindow.getAllWindows()[0];
  assert(window !== undefined);

  await new Promise((resolve) => window.webContents.once("did-finish-load", resolve));
  assert(url === window.webContents.getURL());
}

async function testWindowSizeSettings() {
  const storeWindowName = "settingsTestWindow";

  await ElectronHost.startup();
  await ElectronHost.openMainWindow({ storeWindowName });

  const window = ElectronHost.mainWindow;
  assert(window);

  let size = ElectronHost.getWindowSizeSetting(storeWindowName);
  const expectedSize = ElectronHost.getWindowSizeSetting(storeWindowName);
  assert(size?.width === expectedSize?.width);
  assert(size?.height === expectedSize?.height);
  assert(size?.x === expectedSize?.x);
  assert(size?.y === expectedSize?.y);

  let isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(isMaximized === window.isMaximized());

  window.maximize();
  window.emit("maximize"); // "maximize" event is not emitted when running with xvfb

  isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(isMaximized);

  window.unmaximize();
  window.emit("unmaximize"); // "unmaximize" event is not emitted when running with xvfb

  isMaximized = ElectronHost.getWindowMaximizedSetting(storeWindowName);
  assert(!isMaximized);

  await new Promise((resolve) => setTimeout(resolve, 100)); // Wait for window to "unmaximize"

  const width = 250;
  const height = 251;
  window.setSize(width, height);
  window.emit("resized"); // "resized" event is only emitted during manual resize and only on Windows and Macos
  size = ElectronHost.getWindowSizeSetting(storeWindowName);
  assert(size?.width === width);
  assert(size?.height === height);

  const x = 15;
  const y = 16;
  window.setPosition(x, y);
  window.emit("moved"); // "moved" event is only emitted during manual move and only on Windows and Macos
  size = ElectronHost.getWindowSizeSetting(storeWindowName);
  assert(size?.x === x);
  assert(size?.y === y);
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
