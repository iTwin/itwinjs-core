/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
import { app, BrowserWindow, BrowserWindowConstructorOptions, ipcMain, protocol } from "electron";
import * as fs from "fs";
import * as path from "path";
import { BeDuration } from "@bentley/bentleyjs-core";
import { ElectronRpcConfiguration, IpcListener, IpcSocketBackend, RemoveFunction } from "@bentley/imodeljs-common";
import { DesktopAuthorizationClientIpc } from "./DesktopAuthorizationClientIpc";

// cSpell:ignore signin devserver webcontents

/** @beta */
export interface ElectronManagerOptions {
  webResourcesPath: string;
  iconName?: string;
  frontendURL?: string;
}

/**
 * A helper class that simplifies the creation of basic single-window desktop applications
 * that follow platform-standard window behavior on all platforms.
 * @beta
 */
export class ElectronManager implements IpcSocketBackend {
  private _mainWindow?: BrowserWindow;
  protected readonly _electronFrontend = "electron://frontend/";
  public readonly webResourcesPath: string;
  public readonly appIconPath: string;
  public readonly frontendURL: string;

  private openMainWindow(options: BrowserWindowConstructorOptions = {}) {
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
    DesktopAuthorizationClientIpc.initializeIpc(this.mainWindow!);
  }

  /** The "main" BrowserWindow for this application. */
  public get mainWindow() { return this._mainWindow; }

  constructor(opts?: ElectronManagerOptions) {
    this.webResourcesPath = opts?.webResourcesPath ?? "";
    this.frontendURL = opts?.frontendURL ?? `${this._electronFrontend}index.html`;
    this.appIconPath = path.join(this.webResourcesPath, opts?.iconName ?? "appicon.ico");
  }

  /**
   * wait for the app to be "ready", and then initialize the application by:
   *   - Creating the main BrowserWindow.
   *   - Opening the frontend in the main BrowserWindow.
   *   - Defining some platform-standard window behavior.
   *      - Basically, closing all windows should quit the application on platforms other that MacOS.
   * @param windowOptions Options for constructing the main BrowserWindow.  See: https://electronjs.org/docs/api/browser-window#new-browserwindowoptions
   */
  public async initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void> {
    // quit the application when all windows are closed (unless we're running on MacOS)
    app.on("window-all-closed", () => {
      if (process.platform !== "darwin")
        app.quit();
    });

    // re-open the main window if it was closed and the app is re-activated (this is the normal MacOS behavior)
    app.on("activate", () => {
      if (!this._mainWindow)
        this.openMainWindow(windowOptions);
    });

    if (!app.isReady())
      await new Promise((resolve) => app.on("ready", resolve));

    this.openMainWindow(windowOptions);
  }

  public receive(channel: string, listener: IpcListener): RemoveFunction {
    ipcMain.addListener(channel, listener);
    return () => ipcMain.removeListener(channel, listener);
  }
  public send(message: string, ...args: any[]): void {
    this.mainWindow!.webContents.send(message, ...args);
  }
  public handle(channel: string, listener: (evt: any, ...args: any[]) => Promise<any>): RemoveFunction {
    ipcMain.handle(channel, listener);
    return () => ipcMain.removeHandler(channel);
  }
}

/**
 * A StandardElectronManager that adds some reasonable defaults for iModel.js applications.
 * @beta
 */
export class IModelJsElectronManager extends ElectronManager {
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

  public async initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void> {
    await app.whenReady();
    // handle any "electron://" requests and redirect them to "file://" URLs
    // should registerFileProtocol after app is ready, https://www.electronjs.org/docs/api/protocol
    protocol.registerFileProtocol("electron", (request, callback) => callback(this.parseElectronUrl(request.url)));

    await super.initialize(windowOptions); // must be after registering protocol
  }
}

/**
 * A StandardElectronManager that adds some reasonable defaults for applications built with @bentley/react-scripts running in "development" mode.
 * @beta
 */
export class WebpackDevServerElectronManager extends ElectronManager {
  constructor(opts: ElectronManagerOptions, frontendPort = 3000) {
    opts.frontendURL = opts.frontendURL ?? `http://localhost:${frontendPort}`;
    super(opts);
  }

  public async initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void> {
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

    await super.initialize(windowOptions);
  }
}

// this initialization should always happen before the app starts.
function staticElectronInitialize() {
  app.allowRendererProcessReuse = true; // see https://www.electronjs.org/docs/api/app#appallowrendererprocessreuse
  // eslint-disable-next-line @typescript-eslint/unbound-method
  if (!app.isReady)
    protocol.registerSchemesAsPrivileged([{ scheme: "electron", privileges: { standard: true, secure: true } }]);
}

staticElectronInitialize(); // executed when this file is loaded.
