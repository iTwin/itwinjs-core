// @public
class IModelJsElectronManager extends StandardElectronManager {
  constructor(webResourcesPath?: string);
  // (undocumented)
  protected readonly _defaultWindowOptions: {
    autoHideMenuBar: boolean;
    icon: string;
  }
  // (undocumented)
  appIconPath: string;
  // (undocumented)
  frontendURL: string;
  // (undocumented)
  initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void>;
}

// @public
class StandardElectronManager {
  // (undocumented)
  protected readonly _defaultWindowOptions: BrowserWindowConstructorOptions;
  readonly frontendURL: string;
  initialize(windowOptions?: BrowserWindowConstructorOptions): Promise<void>;
  readonly mainWindow: BrowserWindow | undefined;
}

// @public
class WebpackDevServerElectronManager extends StandardElectronManager {
  constructor(frontendPort?: number);
  // (undocumented)
  protected readonly _defaultWindowOptions: {
    autoHideMenuBar: boolean;
    icon: string;
  }
  // (undocumented)
  appIconPath: string;
  // (undocumented)
  frontendURL: string;
}

// (No @packagedocumentation comment for this package)
