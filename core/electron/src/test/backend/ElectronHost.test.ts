/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import type { BrowserWindow } from "electron";
import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "path";
import { assert } from "chai";
import { IModelHost, IpcHandler, IpcHost, NativeHost } from "@itwin/core-backend";
import { BeDuration, Logger, LogLevel } from "@itwin/core-bentley";
import { RpcInterface, RpcRegistry } from "@itwin/core-common";
import { ElectronBackendLoggerCategory, ElectronHost, ElectronHostOptions } from "../../ElectronBackend";
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
    {
      title: "Should confine electron protocol requests to webResourcesPath.",
      func: testElectronProtocolContainment,
    },
    {
      title: "Should not handle electron protocol without webResourcesPath.",
      func: testNoElectronProtocolWithoutWebResourcesPath,
    },
    {
      title: "Should restrict IPC to the frontend origin.",
      func: testRestrictIpcToFrontendOrigin,
    },
    {
      title: "Should only push IPC messages to the frontend origin.",
      func: testRestrictIpcPushToFrontendOrigin,
    },
    {
      title: "Should reject restricting IPC to an invalid frontend origin.",
      func: testRestrictIpcToInvalidFrontendOrigin,
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

async function testElectronProtocolContainment() {
  // Resolve the temp directory so its path matches what the protocol handler sees (e.g. /var -> /private/var on macOS).
  const tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "electron-host-")));
  try {
    // Siblings whose paths start with the webResourcesPath string, but lie outside that directory.
    const webResourcesPath = path.join(tempDir, "frontend");
    const secret = "outside webResourcesPath";
    fs.mkdirSync(webResourcesPath);
    fs.mkdirSync(path.join(tempDir, "frontend-backup"));
    fs.writeFileSync(path.join(webResourcesPath, "index.html"), "inside webResourcesPath");
    fs.writeFileSync(path.join(webResourcesPath, "100%.png"), "raw percent");
    fs.writeFileSync(path.join(tempDir, "frontend-owned.html"), secret);
    fs.writeFileSync(path.join(tempDir, "frontend-backup", "secret.txt"), secret);

    await ElectronHost.startup({ electronHost: { webResourcesPath } });
    await ElectronHost.openMainWindow();

    const fetchText = async (url: string) => {
      try {
        const response = await ElectronHost.electron.net.fetch(url);
        return response.ok ? await response.text() : undefined;
      } catch {
        return undefined;
      }
    };

    assert.equal(await fetchText("electron://frontend/index.html"), "inside webResourcesPath");
    assert.equal(await fetchText("electron://frontend/"), "inside webResourcesPath");
    assert.equal(await fetchText("electron://frontend/100%.png"), "raw percent");
    assert.equal(await fetchText("electron://frontend/100%25.png"), "raw percent");

    const escapes = [
      "electron://frontend.../frontend-owned.html",
      "electron://frontend/..%2Ffrontend-owned.html",
      "electron://frontend/%2E%2E/frontend-backup/secret.txt",
      "electron://frontend/..%2Ffrontend-backup%2Fsecret.txt",
      "electron://frontend/..%5Cfrontend-backup%5Csecret.txt",
    ];
    for (const url of escapes)
      assert.notEqual(await fetchText(url), secret, url);

    assert.isUndefined(await fetchText("electron://other/index.html"));
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function testNoElectronProtocolWithoutWebResourcesPath() {
  await ElectronHost.startup();
  const errors: string[] = [];
  Logger.initialize((category, message) => errors.push(`${category}: ${message}`));
  Logger.setLevel(ElectronBackendLoggerCategory.ElectronHost, LogLevel.Error);
  await ElectronHost.openMainWindow();
  assert.isFalse(ElectronHost.electron.protocol.isProtocolHandled("electron"));

  // The default frontendURL uses electron://, so the app is told why its window stays blank.
  assert.lengthOf(errors, 1);
  assert.include(errors[0], ElectronBackendLoggerCategory.ElectronHost);
  assert.include(errors[0], "webResourcesPath");
}

async function testRestrictIpcToInvalidFrontendOrigin() {
  for (const frontendURL of ["file:///index.html", "about:blank", "not a url"]) {
    let error: Error | undefined;
    try {
      await ElectronHost.startup({ electronHost: { frontendURL, restrictIpcToFrontendOrigin: true } });
    } catch (err) {
      error = err as Error;
    }

    assert.include(error?.message, "restrictIpcToFrontendOrigin", frontendURL);
    assert.include(error?.message, frontendURL);
    assertElectronHostNotInitialized();
  }
}

async function testRestrictIpcToFrontendOrigin() {
  class OriginTestHandler extends IpcHandler {
    public override get channelName() { return "electron-test/origin-check"; }
    public static calls = 0;
    public async ping() {
      ++OriginTestHandler.calls;
      return "pong";
    }
  }

  const server = http.createServer((_req, res) => res.end("<!DOCTYPE html><html><body>untrusted</body></html>"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const untrustedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const invokePing = `window.itwinjs.invoke("itwin.electron-test/origin-check", "ping")`;
  // A renderer's IPC messages arrive in order, so once the invoke settles, the backend has already handled the send.
  const sendThenPing = (value: number) => `window.itwinjs.send("itwin.electron-test/origin-send", ${value}); ${invokePing}`;
  const sendChannel = "electron-test/origin-send";
  const received: number[] = [];
  const onSend = (_evt: Event, value: number) => received.push(value);

  try {
    await ElectronHost.startup({
      electronHost: {
        webResourcesPath: path.join(__dirname, "..", "assets"),
        restrictIpcToFrontendOrigin: true,
        ipcHandlers: [OriginTestHandler],
      },
    });
    await ElectronHost.openMainWindow();
    const window = ElectronHost.mainWindow;
    assert(window);
    await new Promise((resolve) => window.webContents.once("did-finish-load", () => resolve(undefined)));

    // Pages with the origin of frontendURL can use IPC.
    const removeListener = IpcHost.addListener(sendChannel, onSend);
    assert.deepEqual(await window.webContents.executeJavaScript(sendThenPing(1)), { result: "pong" });
    assert.equal(OriginTestHandler.calls, 1);
    assert.deepEqual(received, [1]);

    // Removing a listener unregisters its origin-checking wrapper.
    removeListener();
    assert.equal(ElectronHost.ipcMain.listenerCount(`itwin.${sendChannel}`), 0);
    assert.deepEqual(await window.webContents.executeJavaScript(sendThenPing(2)), { result: "pong" });
    assert.equal(OriginTestHandler.calls, 2);
    assert.deepEqual(received, [1]);
    IpcHost.addListener(sendChannel, onSend);

    // A page from another origin loaded into the main window doesn't receive the IPC bridge.
    await window.loadURL(untrustedUrl);
    assert.equal(await window.webContents.executeJavaScript("typeof window.itwinjs"), "undefined");

    // Even if a page from another origin obtains the bridge, the backend rejects its messages.
    const otherWindow = new ElectronHost.electron.BrowserWindow({
      show: false,
      webPreferences: { preload: require.resolve("../../backend/ElectronPreload.js"), sandbox: true, contextIsolation: true },
    });
    try {
      await otherWindow.loadURL(untrustedUrl);
      assert.equal(await otherWindow.webContents.executeJavaScript("typeof window.itwinjs"), "object");

      let rejected = false;
      try {
        await otherWindow.webContents.executeJavaScript(sendThenPing(3));
      } catch {
        rejected = true;
      }

      assert.isTrue(rejected);
      assert.equal(OriginTestHandler.calls, 2);
      assert.deepEqual(received, [1]);
    } finally {
      otherWindow.destroy();
    }
  } finally {
    server.close();
  }
}

async function testRestrictIpcPushToFrontendOrigin() {
  const server = http.createServer((_req, res) => res.end("<!DOCTYPE html><html><body>untrusted</body></html>"));
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const untrustedUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  const listenForPush = `window.pushed = new Promise((resolve) => window.itwinjs.addListener("itwin.electron-test/push", (_evt, value) => resolve(value))); undefined`;
  const pushedOrTimeout = `Promise.race([window.pushed, new Promise((resolve) => setTimeout(() => resolve("not received"), 500))])`;

  try {
    await ElectronHost.startup({ electronHost: { webResourcesPath: path.join(__dirname, "..", "assets"), restrictIpcToFrontendOrigin: true } });
    await ElectronHost.openMainWindow();
    const mainWindow = ElectronHost.mainWindow;
    assert(mainWindow);
    await new Promise((resolve) => mainWindow.webContents.once("did-finish-load", () => resolve(undefined)));

    // The frontend in the main window receives pushes.
    await mainWindow.webContents.executeJavaScript(listenForPush);
    IpcHost.send("electron-test/push", 1);
    assert.equal(await mainWindow.webContents.executeJavaScript(pushedOrTimeout), 1);

    // Without a main window, pushes fall back to another window. A page from another origin there doesn't receive them, even if it holds the bridge.
    // The other window is left open: closing every window quits the app on Windows and Linux.
    const otherWindow = new ElectronHost.electron.BrowserWindow({
      show: false,
      webPreferences: { preload: require.resolve("../../backend/ElectronPreload.js"), sandbox: true, contextIsolation: true },
    });
    await otherWindow.loadURL(untrustedUrl);
    await otherWindow.webContents.executeJavaScript(listenForPush);
    await new Promise((resolve) => {
      mainWindow.once("closed", () => resolve(undefined));
      mainWindow.close();
    });
    assert.isUndefined(ElectronHost.mainWindow);

    IpcHost.send("electron-test/push", 2);
    assert.equal(await otherWindow.webContents.executeJavaScript(pushedOrTimeout), "not received");
  } finally {
    server.close();
  }
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
