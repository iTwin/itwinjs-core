/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

// Note: only import types! Does not create a `require("electron")` in JavaScript after transpiling. That's important so this file can
// be imported by apps that sometimes use Electron and sometimes not. Call to `ElectronBackend.initialize`
// will do the necessary `require("electron")`
import { BrowserWindow, BrowserWindowConstructorOptions } from "electron";

import * as fs from "fs";
import * as path from "path";
import { BeDuration, IModelStatus, isElectronMain } from "@bentley/bentleyjs-core";
import { BackendIpc, IModelError, IpcHandler, IpcListener, IpcSocketBackend, RemoveFunction, RpcConfiguration, RpcInterfaceDefinition } from "@bentley/imodeljs-common";
import { DesktopAuthorizationClientIpc } from "./DesktopAuthorizationClientIpc";
import { ElectronRpcConfiguration, ElectronRpcManager } from "./ElectronRpcManager";

// cSpell:ignore signin devserver webcontents copyfile

/**
 * Options for  [[ElectronBackend.initialize]]
 * @beta
 */
export interface ElectronBackendOptions {
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
  /** list of [IpcHandler]($common) classes to register */
  ipcHandlers?: (typeof IpcHandler)[];
}

/**
 * The backend for Electron-based desktop applications
 * @beta
 */
export class ElectronBackend implements IpcSocketBackend {
  private static _instance: ElectronBackend;
  public static get instance() { return this._instance; }
  private _mainWindow?: BrowserWindow;
  private _developmentServer: boolean;
  private _electron: typeof Electron;
  protected readonly _electronFrontend = "electron://frontend/";
  public readonly webResourcesPath: string;
  public readonly appIconPath: string;
  public readonly frontendURL: string;
  public readonly rpcConfig: RpcConfiguration;

  public get ipcMain() { return this._electron.ipcMain; }
  public get app() { return this._electron.app; }
  public get electron() { return this._electron; }
  /**
   * Converts an "electron://frontend/" URL to an absolute file path.
   *
   * We use this protocol in production builds because our frontend must be built with absolute URLs,
   * however, since we're loading everything directly from the install directory, we cannot know the
   * absolute path at build time.
   */
  private parseElectronUrl(requestedUrl: string): string {
    // Note that the "frontend/" path is arbitrary - this is just so we can handle *some* relative URLs...
    let assetPath = requestedUrl.substr(this._electronFrontend.length);
    if (assetPath.length === 0)
      assetPath = "index.html";
    assetPath = assetPath.replace(/(#|\?).*$/, "");

    // NEEDS_WORK: Remove this after migration to DesktopAuthorizationClient
    assetPath = assetPath.replace("signin-callback", "index.html");
    assetPath = path.normalize(`${this.webResourcesPath}/${assetPath}`);

    // File protocols don't follow symlinks, so we need to resolve this to a real path.
    // However, if the file doesn't exist, it's fine to return an invalid path here - the request will just fail with net::ERR_FILE_NOT_FOUND
    try {
      assetPath = fs.realpathSync(assetPath);
    } catch (error) {
      // eslint-disable-next-line no-console
      // console.warn(`WARNING: Frontend requested "${requestedUrl}", but ${assetPath} does not exist`);
    }
    return assetPath;
  }

  private _openWindow(options: BrowserWindowConstructorOptions = {}) {
    const opts: BrowserWindowConstructorOptions = {
      autoHideMenuBar: true,
      webPreferences: {
        preload: require.resolve(/* webpack: copyfile */"./ElectronPreload.js"),
        nodeIntegration: false,
        experimentalFeatures: false,
        enableRemoteModule: false,
        contextIsolation: true,
        sandbox: true,
      },
      icon: this.appIconPath,
      ...options, // overrides everything above
    };

    this._mainWindow = new BrowserWindow(opts);
    ElectronRpcConfiguration.targetWindowId = this._mainWindow.id;
    this._mainWindow.on("closed", () => this._mainWindow = undefined);
    this._mainWindow.loadURL(this.frontendURL); // eslint-disable-line @typescript-eslint/no-floating-promises

    // Setup handlers for IPC calls to support Authorization
    DesktopAuthorizationClientIpc.initializeIpc();
  }

  /** The "main" BrowserWindow for this application. */
  public get mainWindow() { return this._mainWindow; }

  private constructor(opts?: ElectronBackendOptions) {
    this._electron = require("electron");
    this._developmentServer = opts?.developmentServer ?? false;
    const frontendPort = opts?.frontendPort ?? 3000;
    this.webResourcesPath = opts?.webResourcesPath ?? "";
    this.frontendURL = opts?.frontendURL ?? this._developmentServer ? `http://localhost:${frontendPort}` : `${this._electronFrontend}index.html`;
    this.appIconPath = path.join(this.webResourcesPath, opts?.iconName ?? "appicon.ico");
    BackendIpc.initialize(this);
    this.rpcConfig = ElectronRpcManager.initializeBackend(this, opts?.rpcInterfaces);
    opts?.ipcHandlers?.forEach((ipc) => ipc.register());
  }

  /**
   * Open the main Window when the app is ready.
   * @param windowOptions Options for constructing the main BrowserWindow. See: https://electronjs.org/docs/api/browser-window#new-browserwindowoptions
   */
  public async openMainWindow(windowOptions?: BrowserWindowConstructorOptions): Promise<void> {
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
      // handle any "electron://" requests and redirect them to "file://" URLs
      require("electron").protocol.registerFileProtocol("electron", (request, callback) => callback(this.parseElectronUrl(request.url)));
    }

    this._openWindow(windowOptions);
  }

  /** @internal */
  public addListener(channel: string, listener: IpcListener): RemoveFunction {
    this.ipcMain.addListener(channel, listener);
    return () => this.ipcMain.removeListener(channel, listener);
  }
  /** @internal */
  public removeListener(channel: string, listener: IpcListener) {
    this.ipcMain.removeListener(channel, listener);
  }
  /** @internal */
  public send(channel: string, ...args: any[]): void {
    const window = this.mainWindow ?? BrowserWindow.getAllWindows()[0];
    window?.webContents.send(channel, ...args);
  }
  /** @internal */
  public handle(channel: string, listener: (evt: any, ...args: any[]) => Promise<any>): RemoveFunction {
    this.ipcMain.removeHandler(channel); // make sure there's not already a handler registered
    this.ipcMain.handle(channel, listener);
    return () => this.ipcMain.removeHandler(channel);
  }

  /**
   * Initialize the backend of an Electron app.
   * This method configures the backend for all of the inter-process communication (RPC and IPC) for an
   * Electron app. It should be called from your Electron main function, before calling [IModelHost.startup]($backend).
   * @param opts Options that control aspects of your backend.
   * @returns an instance of [[ElectronBackend]]. When you are ready to show your main window, call `openMainWindow` on it.
   * @note This method must (only) be called from the backend of an Electron app (i.e. when [isElectronMain]($bentley) is `true`). */
  public static initialize(opts?: ElectronBackendOptions): ElectronBackend {
    if (!isElectronMain)
      throw new Error("Not running under Electron");

    if (this._instance)
      return this._instance;

    this._instance = new ElectronBackend(opts);
    ElectronBackendImpl.register();

    const app = this.instance.app;
    app.allowRendererProcessReuse = true; // see https://www.electronjs.org/docs/api/app#appallowrendererprocessreuse
    if (!app.isReady())
      this.instance.electron.protocol.registerSchemesAsPrivileged([{ scheme: "electron", privileges: { standard: true, secure: true } }]);

    return this._instance;
  };
}

class ElectronBackendImpl extends IpcHandler {
  public get channelName() { return "electron-safe"; };
  public async callElectron(member: string, method: string, ...args: any) {
    const func = (ElectronBackend.instance.electron as any)[member][method];
    if (typeof func !== "function")
      throw new IModelError(IModelStatus.FunctionNotFound, `Method ${method} not found electron.${member}`);

    return func.call(...args);
  }
}
