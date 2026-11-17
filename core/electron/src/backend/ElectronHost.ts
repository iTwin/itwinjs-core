/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Main
 */

// Note: only import *types* from electron so this file can be imported by apps that sometimes use Electron and sometimes not.
import type { BrowserWindow, BrowserWindowConstructorOptions, WebPreferences } from "electron";
import type * as ElectronModule from "electron";

import * as fs from "fs";
import * as path from "path";
import { pathToFileURL } from "node:url";
import { AsyncMethodsOf, BeDuration, IModelStatus, Logger, ProcessDetector } from "@itwin/core-bentley";
import { IpcHandler, IpcHost, NativeHost, NativeHostOpts } from "@itwin/core-backend";
import { IModelError, IpcListener, IpcSocketBackend, RemoveFunction, RpcConfiguration, RpcInterfaceDefinition } from "@itwin/core-common";
import { ElectronRpcConfiguration, ElectronRpcManager } from "../common/ElectronRpcManager.js";
import { electronIpcStrings } from "../common/ElectronIpcInterface.js";
import { ElectronBackendLoggerCategory } from "./ElectronBackendLoggerCategory.js";

// cSpell:ignore signin devserver webcontents copyfile unmaximize eopt

/** Must match the argument parsed by ElectronPreload.ts, which can't import it because sandboxed preloads can't require local modules. */
const ipcOriginArgument = "--itwinjs-ipc-origin=";

class ElectronIpc implements IpcSocketBackend {
  /** Origin-checking wrappers registered with ipcMain, keyed by channel and the listener they wrap. */
  private _guardedListeners = new Map<string, Map<IpcListener, IpcListener[]>>();

  /** @param trustedOrigin The only origin allowed to use IPC, or `undefined` to accept messages from any page. */
  public constructor(public readonly trustedOrigin?: string) { }

  private isTrustedSender(evt: any, channel: string): boolean {
    if (undefined === this.trustedOrigin)
      return true;

    // senderFrame is null if the frame has navigated away or been destroyed since sending.
    const origin: string | undefined = evt?.senderFrame?.origin;
    if (origin === this.trustedOrigin)
      return true;

    Logger.logWarning(ElectronBackendLoggerCategory.ElectronHost, `Rejected IPC message on channel "${channel}" from untrusted origin "${origin}"`);
    return false;
  }

  public addListener(
    channel: string,
    listener: (evt: any, ...args: any[]) => void, // There is mismatch between IPC Event and Electron.IpcMainEvent. Defining `evt` as any as a temporary fix
  ): RemoveFunction {
    const guarded = (evt: any, ...args: any[]) => {
      if (this.isTrustedSender(evt, channel))
        listener(evt, ...args);
    };

    let channelListeners = this._guardedListeners.get(channel);
    if (undefined === channelListeners)
      this._guardedListeners.set(channel, channelListeners = new Map());

    const wrappers = channelListeners.get(listener) ?? [];
    wrappers.push(guarded);
    channelListeners.set(listener, wrappers);

    ElectronHost.ipcMain.addListener(channel, guarded);
    return () => this.removeListener(channel, listener);
  }

  public removeListener(channel: string, listener: IpcListener) {
    const channelListeners = this._guardedListeners.get(channel);
    const wrappers = channelListeners?.get(listener);
    const guarded = wrappers?.pop();
    if (undefined === channelListeners || undefined === wrappers || undefined === guarded)
      return;

    if (0 === wrappers.length)
      channelListeners.delete(listener);

    if (0 === channelListeners.size)
      this._guardedListeners.delete(channel);

    ElectronHost.ipcMain.removeListener(channel, guarded);
  }

  public send(channel: string, ...args: any[]): void {
    const window = ElectronHost.mainWindow ?? ElectronHost.electron.BrowserWindow.getAllWindows()[0];
    if (undefined !== this.trustedOrigin && window?.webContents.mainFrame.origin !== this.trustedOrigin)
      return;

    window?.webContents.send(channel, ...args);
  }

  public handle(channel: string, listener: (evt: any, ...args: any[]) => Promise<any>): RemoveFunction {
    ElectronHost.ipcMain.removeHandler(channel); // make sure there's not already a handler registered
    ElectronHost.ipcMain.handle(channel, async (evt: any, ...args: any[]) => {
      if (!this.isTrustedSender(evt, channel))
        throw new Error(`IPC request on channel "${channel}" was rejected because its sender is not a trusted origin`);

      return listener(evt, ...args);
    });
    return () => ElectronHost.ipcMain.removeHandler(channel);
  }
}

/**
 * Options for  [[ElectronHost.startup]]
 * @beta
 */
export interface ElectronHostOptions {
  /** the path to find web resources  */
  webResourcesPath?: string;
  /** filename for the app's icon, relative to [[webResourcesPath]] */
  iconName?: string;
  /** name of frontend url to open.  */
  frontendURL?: string;
  /** use a development server rather than the "electron" protocol for loading frontend (see https://www.electronjs.org/docs/api/protocol) */
  developmentServer?: boolean;
  /** port number for development server. Default is 3000 */
  frontendPort?: number;
  /** list of RPC interface definitions to register */
  rpcInterfaces?: RpcInterfaceDefinition[];
  /** list of [IpcHandler]($backend) classes to register */
  ipcHandlers?: (typeof IpcHandler)[];
  /**
   * If true, only pages with the same origin as [[frontendURL]] can communicate with the backend over IPC. IPC messages sent from pages with
   * any other origin are rejected, and pages with any other origin loaded into the main window don't receive the `window.itwinjs` IPC bridge.
   * [[frontendURL]] must then have a non-`file:` origin, such as the default `electron://frontend` or `http://localhost:3000` for a development server.
   * Default is false, in which case IPC messages are accepted from any page.
   */
  restrictIpcToFrontendOrigin?: boolean;
}

/** @beta */
export interface ElectronHostOpts extends NativeHostOpts {
  electronHost?: ElectronHostOptions;
}

/** @beta */
export interface ElectronHostWindowOptions extends BrowserWindowConstructorOptions {
  /** Name used to construct key for saving window size, position and maximize status to the settings store */
  storeWindowName?: string;
  /** The style of window title bar. Default is `default`. */
  titleBarStyle?: ("default" | "hidden" | "hiddenInset" | "customButtonsOnHover");
  /** Web page settings */
  webPreferences?: Omit<WebPreferences, "preload" | "experimentalFeatures" | "nodeIntegration" | "contextIsolation" | "sandbox" | "nodeIntegrationInWorker" | "nodeIntegrationInSubFrames">;
}

/** the size and position of a window as stored in the settings file.
 * @beta
 */
export interface WindowSizeAndPositionProps {
  width: number;
  height: number;
  x: number;
  y: number;
}

/**
 * The backend for Electron-based desktop applications
 * @beta
 */
export class ElectronHost {
  private static _ipc: ElectronIpc;
  private static _developmentServer: boolean;
  private static _electron: typeof ElectronModule;
  private static _electronFrontendHost = "frontend";
  private static _electronFrontend = `electron://${this._electronFrontendHost}/`;
  private static _mainWindow?: BrowserWindow;
  public static webResourcesPath: string;
  public static appIconPath: string;
  public static frontendURL: string;
  public static rpcConfig: RpcConfiguration;
  public static get ipcMain() { return this._electron?.ipcMain; }
  public static get app() { return this._electron?.app; }
  public static get electron() { return this._electron; }

  private constructor() { }

  /**
   * Converts an "electron://frontend/" URL to an "file://{absolute file path}" URL.
   *
   * We use this protocol in production builds because our frontend must be built with absolute URLs,
   * however, since we're loading everything directly from the install directory, we cannot know the
   * absolute path at build time.
   */
  private static transformElectronUrlToFileUrl(requestedUrl: string): string {
    // Note that the "frontend" host is arbitrary - this is just so we can handle *some* relative URLs...
    const url = new URL(requestedUrl);
    if (url.host !== this._electronFrontendHost)
      throw new Error(`Unsupported host "${url.host}" in "${requestedUrl}"`);

    // Decode each run of escapes separately, so a raw "%" (e.g. "my%20file%.png") doesn't prevent decoding the rest.
    let assetPath = url.pathname.replace(/(?:%[0-9a-f]{2})+/gi, (escapes) => {
      try {
        return decodeURIComponent(escapes);
      } catch {
        return escapes; // Not valid UTF-8, so keep it as written.
      }
    });

    assetPath = assetPath.replace(/^\/+/, "");
    if (assetPath.length === 0)
      assetPath = "index.html";

    // File protocols don't follow symlinks, so we need to resolve this to a real path.
    // However, if the file doesn't exist, it's fine to return an invalid path here - the request will just fail with net::ERR_FILE_NOT_FOUND
    const realPath = (filePath: string) => {
      try {
        return fs.realpathSync(filePath);
      } catch {
        return filePath;
      }
    };

    const root = realPath(path.resolve(this.webResourcesPath));
    assetPath = realPath(path.join(root, assetPath));
    // Unlike a string prefix test, this rejects siblings such as `root-backup`.
    const relative = path.relative(root, assetPath);
    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(`..${path.sep}`))
      throw new Error(`Access to files outside installation directory (${this.webResourcesPath}) is prohibited`);

    return pathToFileURL(assetPath).href;
  }

  private static _openWindow(options?: ElectronHostWindowOptions) {
    const webPreferences: WebPreferences = {
      ...options?.webPreferences,
      ...(this._ipc.trustedOrigin && {
        additionalArguments: [
          ...(options?.webPreferences?.additionalArguments ?? []),
          `${ipcOriginArgument}${this._ipc.trustedOrigin}`,
        ],
      }),

      // These web preference variables should not be overriden by the ElectronHostWindowOptions
      preload: require.resolve(/* webpack: copyfile */"./ElectronPreload.js"),
      experimentalFeatures: false,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
    };

    const opts: BrowserWindowConstructorOptions = {
      ...options,
      autoHideMenuBar: true,
      icon: this.appIconPath,
      webPreferences,
    };

    this._mainWindow = new (this.electron.BrowserWindow)(opts);
    ElectronRpcConfiguration.targetWindowId = this._mainWindow.id;
    this._mainWindow.on("closed", () => this._mainWindow = undefined);
    this._mainWindow.loadURL(this.frontendURL); // eslint-disable-line @typescript-eslint/no-floating-promises

    /** Monitors and saves main window size, position and maximized state */
    if (options?.storeWindowName) {
      const mainWindow = this._mainWindow;
      const windowName = options.storeWindowName;
      const saveWindowPosition = () => {
        const bounds: WindowSizeAndPositionProps = mainWindow.getBounds();
        NativeHost.settingsStore.setData(`windowSizeAndPos-${windowName}`, JSON.stringify(bounds));
      };
      const saveMaximized = (maximized: boolean) => {
        NativeHost.settingsStore.setData(`windowMaximized-${windowName}`, maximized);
      };
      const saveWindowState = () => {
        saveWindowPosition();
        saveMaximized(mainWindow.isMaximized());
      };

      mainWindow.on("maximize", () => saveMaximized(true));
      mainWindow.on("unmaximize", () => saveMaximized(false));

      const debouncedSaveWindowState = debounce(() => saveWindowState());
      mainWindow.on("resize", () => debouncedSaveWindowState());
      mainWindow.on("move", () => debouncedSaveWindowState());
      saveWindowState();
    }
  }

  /** The "main" BrowserWindow for this application. */
  public static get mainWindow() { return this._mainWindow; }

  /**
   * Gets window size and position for a window, by name, from settings file, if present.
   */
  public static getWindowSizeAndPositionSetting(windowName: string): WindowSizeAndPositionProps | undefined {
    const saved = NativeHost.settingsStore.getString(`windowSizeAndPos-${windowName}`);
    return saved ? JSON.parse(saved) as WindowSizeAndPositionProps : undefined;
  }

  /** Gets "window maximized" flag for a window, by name, from settings file if present */
  public static getWindowMaximizedSetting(windowName: string): boolean | undefined {
    return NativeHost.settingsStore.getBoolean(`windowMaximized-${windowName}`);
  }

  /**
   * Open the main Window when the app is ready.
   * @param windowOptions Options for constructing the main BrowserWindow. See: https://electronjs.org/docs/api/browser-window#new-browserwindowoptions
   */
  public static async openMainWindow(windowOptions?: ElectronHostWindowOptions): Promise<void> {
    const app = this.app;
    // quit the application when all windows are closed (unless we're running on MacOS)
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin")
        app.quit();
    });

    // re-open the main window if it was closed and the app is re-activated (this is the normal MacOS behavior)
    app.on("activate", () => {
      if (!this._mainWindow)
        this._openWindow(windowOptions);
    });

    if (this._developmentServer) {
      // Occasionally, the electron backend may start before the webpack devserver has even started.
      // If this happens, we'll just retry and keep reloading the page.
      app.on("web-contents-created", (_e, webcontents) => {
        webcontents.on("did-fail-load", async (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
          // errorCode -102 is CONNECTION_REFUSED - see https://cs.chromium.org/chromium/src/net/base/net_error_list.h
          if (isMainFrame && errorCode === -102) {
            await BeDuration.wait(100);
            webcontents.reload();
          }
        });
      });
    }

    await app.whenReady();

    if (!this._developmentServer) {
      // Without webResourcesPath there is nothing to serve. Its root would resolve to the current working directory,
      // so the handler would serve files from wherever the app was launched.
      if (this.webResourcesPath) {
        // handle any "electron://" requests and redirect them to "file://" URLs
        this.electron.protocol.handle("electron", async (request) => ElectronHost.electron.net.fetch(this.transformElectronUrlToFileUrl(request.url)));
      } else if (this.frontendURL.toLowerCase().startsWith("electron:")) {
        Logger.logError(ElectronBackendLoggerCategory.ElectronHost, `frontendURL "${this.frontendURL}" can't be loaded because webResourcesPath is not set, so electron:// requests aren't handled`);
      }
    }

    this._openWindow(windowOptions);
  }

  public static get isValid() { return this._ipc !== undefined; }

  /**
   * Initialize the backend of an Electron app.
   * This method configures the backend for all of the inter-process communication (RPC and IPC) for an
   * Electron app. It should be called from your Electron main function.
   * @param opts Options that control aspects of your backend.
   * @note This method must only be called from the backend of an Electron app (i.e. when [ProcessDetector.isElectronAppBackend]($bentley) is `true`).
   */
  public static async startup(opts?: ElectronHostOpts) {
    if (!ProcessDetector.isElectronAppBackend)
      throw new Error("Not running under Electron");

    if (!this.isValid) {
      const eopt = opts?.electronHost;
      const developmentServer = eopt?.developmentServer ?? false;
      const frontendPort = eopt?.frontendPort ?? 3000;
      const webResourcesPath = eopt?.webResourcesPath ?? "";
      const frontendURL = eopt?.frontendURL ?? (developmentServer ? `http://localhost:${frontendPort}` : `${this._electronFrontend}index.html`);

      // Validated before assigning anything, so an invalid frontendURL leaves the host uninitialized.
      let trustedIpcOrigin: string | undefined;
      if (eopt?.restrictIpcToFrontendOrigin) {
        let url: URL | undefined;
        try {
          url = new URL(frontendURL);
        } catch { }

        // Every local file shares the "file://" origin, so it can't restrict IPC to the frontend.
        if (undefined === url || url.protocol === "file:" || url.host === "")
          throw new Error(`restrictIpcToFrontendOrigin requires a frontendURL with a non-file, non-opaque origin, but got "${frontendURL}"`);

        // Node reports "null" as the origin of non-special schemes like "electron:", so build it in the form Electron reports for a frame.
        trustedIpcOrigin = `${url.protocol}//${url.host.toLowerCase()}`;
      }

      this._developmentServer = developmentServer;
      this.webResourcesPath = webResourcesPath;
      this.frontendURL = frontendURL;
      this.appIconPath = path.join(webResourcesPath, eopt?.iconName ?? "appicon.ico");
      this._electron = require("electron"); // eslint-disable-line @typescript-eslint/no-require-imports
      this._ipc = new ElectronIpc(trustedIpcOrigin);
      const app = this.app;
      if (!app.isReady())
        this.electron.protocol.registerSchemesAsPrivileged([{
          scheme: "electron",
          privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
          },
        }]);

      this.rpcConfig = ElectronRpcManager.initializeBackend(this._ipc, eopt?.rpcInterfaces);
    }

    opts = opts ?? {};
    opts.ipcHost = opts.ipcHost ?? {};
    opts.ipcHost.socket = this._ipc;
    await NativeHost.startup(opts);
    if (IpcHost.isValid) {
      ElectronDialogHandler.register();
      opts.electronHost?.ipcHandlers?.forEach((ipc) => ipc.register());
    }
  }
}

class ElectronDialogHandler extends IpcHandler {
  public get channelName() { return electronIpcStrings.dialogChannel; }
  public async callDialog(method: AsyncMethodsOf<Electron.Dialog>, ...args: any) {
    const dialog = ElectronHost.electron.dialog;
    if (typeof dialog[method] !== "function")
      throw new IModelError(IModelStatus.FunctionNotFound, `illegal electron dialog method`);

    return (dialog[method] as (...args: any[]) => any).call(dialog, ...args);
  }
}

function debounce(func: (...args: any[]) => any, ms: number = 200) {
  let timeout: NodeJS.Timeout;
  return function (this: any, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, args);
    }, ms);
  };
}
