/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import * as path from "path";

// Note that we're never actually importing electron here - we're only using import types, so the generated .js never includes `require("electron")`
// This way, the imodeljs-backend package doesn't need to have a dependency on electron.
// tslint:disable:whitespace -- FIXME: This is a bug in TSLint: https://github.com/palantir/tslint/issues/3987
type ElectronModule = import("electron").MainInterface;
type ElectronApp = import("electron").App;
type BrowserWindow = import("electron").BrowserWindow;
type BrowserWindowConstructorOptions = import("electron").BrowserWindowConstructorOptions;
type Protocol = import("electron").Protocol;
// tslint:enable:whitespace

/**
 * Wrap electron's [app](https://electronjs.org/docs/api/app) object simplify the creation of simple
 * single-window desktop applications that follow platform-standard window behavior on all platforms.
 */
export abstract class StandardElectronAppManager {
  private _mainWindow?: BrowserWindow;
  private _openMainWindow: (options: BrowserWindowConstructorOptions) => void;
  protected _app: ElectronApp;
  protected get _defaultWindowOptions(): BrowserWindowConstructorOptions { return {}; }

  /**
   * @param electron The electron module (basically, everything returned by `require("electron")`).
   */
  constructor(electron: ElectronModule) {
    this._app = electron.app;

    this._openMainWindow = (options: BrowserWindowConstructorOptions) => {
      this._mainWindow = new electron.BrowserWindow({ ...this._defaultWindowOptions, ...options });
      this._mainWindow.on("closed", () => this._mainWindow = undefined);
      this._mainWindow.loadURL(this.frontendURL);
    };
  }

  /** The URL the main BrowserWindow should load on application initialization. */
  public abstract get frontendURL(): string;

  /** The "main" BrowserWindow for this application. */
  public get mainWindow() { return this._mainWindow; }

  /**
   * Once electron is "ready", initializes the application by:
   *   - Creating the main BrowserWindow.
   *   - Opening the frontend in the main BrowserWindow.
   *   - Defining some platform-standard window behavior.
   *      - Basically, closing all windows should quit the application on platforms other that MacOS.
   * @param windowOptions Options for constructing the main BrowserWindow.  See: https://electronjs.org/docs/api/browser-window#new-browserwindowoptions
   */
  public async initialize(windowOptions: BrowserWindowConstructorOptions = {}): Promise<void> {
    // quit the application when all windows are closed (unless we're running on MacOS)
    this._app.on("window-all-closed", () => {
      if (process.platform !== "darwin")
        this._app.quit();
    });

    // re-open the main window if it was closed and the app is re-activated (this is the normal MacOS behavior)
    this._app.on("activate", () => {
      if (!this._mainWindow)
        this._openMainWindow(windowOptions);
    });

    if (!this._app.isReady())
      await new Promise((resolve) => this._app.on("ready", resolve));

    this._openMainWindow(windowOptions);
  }
}

/**
 * Converts an "electron://" URL to an absolute file path.
 *
 * We use this protocol in production builds because our frontend must be built with absolute URLs,
 * however, since we're loading everything directly from the install directory, we cannot know the
 * absolute path at build time.
 */
function parseElectronUrl(requestedUrl: string): string {
  let assetPath = requestedUrl.substr("electron://".length);
  assetPath = assetPath.replace(/#.*$/, "");
  return path.normalize(`${__dirname}/public/${assetPath}`);
}

/**
 * A StandardElectronAppManager that adds some reasonable defaults for applications built with @bentley/webpack-tools.
 */
export class IModelJsElectronAppManager extends StandardElectronAppManager {
  private readonly _isDevBuild = process.env.NODE_ENV === "development";
  private _protocol: Protocol;

  constructor(electron: ElectronModule) {
    super(electron);
    this._protocol = electron.protocol;
  }

  protected get _defaultWindowOptions() {
    return {
      autoHideMenuBar: true,
      icon: this.appIconPath,
    };
  }

  // In development builds, the frontend assets are served by the webpack devserver.
  // In production builds, load the built frontend assets directly from the filesystem.
  public frontendURL = (this._isDevBuild) ? "http://localhost:3000" : parseElectronUrl("electron://index.html");

  /** The absolute file path of the application icon. */
  public get appIconPath() {
    // In dev builds (npm start), webpack-tools doesn't copy the public folder to lib/public,
    // so we'll need to access the original public dir for our app icon
    return (this._isDevBuild) ? path.join(__dirname, "../public/appicon.ico") : path.join(__dirname, "public/appicon.ico");
  }

  public async initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void> {
    await super.initialize(windowOptions);

    // Also handle any "electron://" requests and redirect them to "file://" URLs
    this._protocol.registerFileProtocol("electron", (request, callback) => callback(parseElectronUrl(request.url)));
  }
}
