/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module IModelApp
 */

// @ts-expect-error package.json will resolve from the lib/{cjs,esm} dir without copying it into the build output we deliver
// eslint-disable-next-line @itwin/import-within-package
import packageJson from "../../package.json";
/** @public */
export const ITWINJS_CORE_VERSION = packageJson.version as string;
const COPYRIGHT_NOTICE = 'Copyright © 2017-2024 <a href="https://www.bentley.com" target="_blank" rel="noopener noreferrer">Bentley Systems, Inc.</a>';

import { UiAdmin } from "@itwin/appui-abstract";
import { AccessToken, BeDuration, BeEvent, BentleyStatus, DbResult, dispose, Guid, GuidString, Logger, ProcessDetector } from "@itwin/core-bentley";
import {
  AuthorizationClient, IModelStatus, Localization, RealityDataAccess, RpcConfiguration, RpcInterfaceDefinition, RpcRequest, SerializedRpcActivity,
} from "@itwin/core-common";
import { ITwinLocalization } from "@itwin/core-i18n";
import { TelemetryManager } from "@itwin/core-telemetry";
import { queryRenderCompatibility, WebGLRenderCompatibilityInfo } from "@itwin/webgl-compatibility";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import * as auxCoordState from "./AuxCoordSys";
import * as categorySelectorState from "./CategorySelectorState";
import { ExtensionAdmin } from "./extension/ExtensionAdmin";
import * as displayStyleState from "./DisplayStyleState";
import * as drawingViewState from "./DrawingViewState";
import { ElementLocateManager } from "./ElementLocateManager";
import { EntityState } from "./EntityState";
import { FrontendHubAccess } from "./FrontendHubAccess";
import { FrontendLoggerCategory } from "./common/FrontendLoggerCategory";
import * as modelselector from "./ModelSelectorState";
import * as modelState from "./ModelState";
import { NotificationManager } from "./NotificationManager";
import { QuantityFormatter } from "./quantity-formatting/QuantityFormatter";
import { RenderSystem } from "./render/RenderSystem";
import { System } from "./render/webgl/System";
import * as sheetState from "./SheetViewState";
import * as spatialViewState from "./SpatialViewState";
import { TentativePoint } from "./TentativePoint";
import { RealityDataSourceProviderRegistry } from "./RealityDataSource";
import { MapLayerFormatRegistry, MapLayerOptions, TerrainProviderRegistry, TileAdmin } from "./tile/internal";
import * as accudrawTool from "./tools/AccuDrawTool";
import * as clipViewTool from "./tools/ClipViewTool";
import * as idleTool from "./tools/IdleTool";
import * as measureTool from "./tools/MeasureTool";
import * as selectTool from "./tools/SelectTool";
import { ToolRegistry } from "./tools/Tool";
import { ToolAdmin } from "./tools/ToolAdmin";
import * as viewTool from "./tools/ViewTool";
import { UserPreferencesAccess } from "./UserPreferences";
import { ViewManager } from "./ViewManager";
import * as viewState from "./ViewState";
import "./IModeljs-css";

// cSpell:ignore noopener noreferrer gprid forin nbsp csrf xsrf

/** Options that can be supplied with [[IModelAppOptions]] to customize frontend security.
 * @public
 * @extensions
 */
export interface FrontendSecurityOptions {
  /** Configures protection from Cross Site Request Forgery attacks. */
  readonly csrfProtection?: {
    /** If enabled, IModelApp will extract the CSRF token for the current session from the document's cookies and send it with each request as a header value. */
    readonly enabled: boolean;
    /** Defaults to XSRF-TOKEN. */
    readonly cookieName?: string;
    /** Defaults to X-XSRF-TOKEN. */
    readonly headerName?: string;
  };
}

/** Options that can be supplied to [[IModelApp.startup]] to customize frontend behavior.
 * @public
 */
export interface IModelAppOptions {
  /** If present, supplies the [[FrontendHubAccess]] for this session. */
  hubAccess?: FrontendHubAccess;
  /** If present, supplies the Id of this application. Applications must set this to the Bentley Global Product Registry Id (GPRID) for usage logging. */
  applicationId?: string;
  /** If present, supplies the version of this application. Must be set for usage logging. */
  applicationVersion?: string;
  /** If present, supplies the [[UserPreferencesAccess]] for this session.
   * @beta
   */
  userPreferences?: UserPreferencesAccess;
  /** If present, supplies the [[ViewManager]] for this session. */
  viewManager?: ViewManager;
  /** If present, supplies Map Layer Options for this session such as Azure Access Keys
   * @beta
   */
  mapLayerOptions?: MapLayerOptions;
  /** If present, supplies the properties with which to initialize the [[TileAdmin]] for this session. */
  tileAdmin?: TileAdmin.Props;
  /** If present, supplies the [[NotificationManager]] for this session. */
  notifications?: NotificationManager;
  /** If present, supplies the [[ToolAdmin]] for this session. */
  toolAdmin?: ToolAdmin;
  /** If present, supplies the [[AccuDraw]] for this session. */
  accuDraw?: AccuDraw;
  /** If present, supplies the [[AccuSnap]] for this session. */
  accuSnap?: AccuSnap;
  /** If present, supplies the [[Localization]] for this session. Defaults to [ITwinLocalization]($i18n). */
  localization?: Localization;
  /** The AuthorizationClient used to obtain [AccessToken]($bentley)s. */
  authorizationClient?: AuthorizationClient;
  /** If present, supplies security options for the frontend. */
  security?: FrontendSecurityOptions;
  /** @internal */
  sessionId?: GuidString;
  /** @internal */
  locateManager?: ElementLocateManager;
  /** If present, supplies the [[TentativePoint]] for this session. */
  tentativePoint?: TentativePoint;
  /** @internal */
  quantityFormatter?: QuantityFormatter;
  /** If present, supplies an implementation of the render system, or options for initializing the default render system. */
  renderSys?: RenderSystem | RenderSystem.Options;
  /** If present, supplies the [[UiAdmin]] for this session. */
  uiAdmin?: UiAdmin;
  /** If present, determines whether iModelApp is a NoRenderApp
   *  @internal
   */
  noRender?: boolean;
  /**
   * @deprecated in 3.7. Specify desired RPC interfaces in the platform-specific RPC manager call instead.
   * See [[MobileRpcManager.initializeClient]], [[ElectronRpcManager.initializeFrontend]], [[BentleyCloudRpcManager.initializeClient]].
   */
  rpcInterfaces?: RpcInterfaceDefinition[];
  /** @beta */
  realityDataAccess?: RealityDataAccess;
  /** If present, overrides where public assets are fetched. The default is to fetch assets relative to the current URL.
   * The path should always end with a trailing `/`.
   */
  publicPath?: string;
}

/** Options for [[IModelApp.makeModalDiv]]
 *  @public
 */
export interface ModalOptions {
  /** Width for the Modal dialog box. */
  width?: number;
  /** The dialog should be dismissed if the user clicks anywhere or hits Enter or Escape on the keyboard. */
  autoClose?: boolean;
  /** Show an 'x' in the upper right corner to close the dialog */
  closeBox?: boolean;
  /** The parent for the semi transparent *darkening* div. If not present, use `document.body` */
  rootDiv?: HTMLElement;
}

/** Return type for [[IModelApp.makeModalDiv]]
 * @public
 */
export interface ModalReturn {
  /** The modal HTMLDivElement created. */
  modal: HTMLDivElement;
  /** A function that can be set as an event handler to stop the modal dialog. This can be used if [[ModalOptions.autoClose]] or [[IModalOptions.closeBox]]
   * were not enabled for the dialog.
   */
  stop: (_ev: Event) => void;
}

/** We hang the IModelApp object off the global `window` object in IModelApp.startup for debugging purposes.
 * It's removed in IModelApp.shutdown.
 */
interface IModelAppForDebugger {
  iModelAppForDebugger?: typeof IModelApp;
}

/**
 * Global singleton that connects the user interface with the iTwin.js services. There can be only one IModelApp active in a session. All
 * members of IModelApp are static, and it serves as a singleton object for gaining access to session information.
 *
 * Before any interactive operations may be performed by the `@itwin/core-frontend package`, [[IModelApp.startup]] must be called and awaited.
 * Applications may customize the frontend behavior of iTwin.js by supplying options to [[IModelApp.startup]].
 *
 * @public
 */
export class IModelApp {
  private static _initialized = false;
  private static _accuDraw: AccuDraw;
  private static _accuSnap: AccuSnap;
  private static _applicationId: string;
  private static _applicationVersion: string;
  private static _localization: Localization;
  private static _locateManager: ElementLocateManager;
  private static _notifications: NotificationManager;
  private static _quantityFormatter: QuantityFormatter;
  private static _renderSystem?: RenderSystem;
  private static _userPreferences?: UserPreferencesAccess;
  private static _tentativePoint: TentativePoint;
  private static _tileAdmin: TileAdmin;
  private static _toolAdmin: ToolAdmin;
  private static _viewManager: ViewManager;
  private static _uiAdmin: UiAdmin;
  private static _noRender: boolean;
  private static _wantEventLoop = false;
  private static _animationRequested = false;
  private static _animationInterval: BeDuration | undefined = BeDuration.fromSeconds(1);
  private static _animationIntervalId?: number;
  private static _securityOptions: FrontendSecurityOptions;
  private static _mapLayerFormatRegistry: MapLayerFormatRegistry;
  private static _terrainProviderRegistry: TerrainProviderRegistry;
  private static _realityDataSourceProviders: RealityDataSourceProviderRegistry;
  private static _hubAccess?: FrontendHubAccess;
  private static _realityDataAccess?: RealityDataAccess;
  private static _publicPath: string;

  // No instances of IModelApp may be created. All members are static and must be on the singleton object IModelApp.
  protected constructor() { }

  /** Event raised just before the frontend IModelApp is to be [[shutdown]]. */
  public static readonly onBeforeShutdown = new BeEvent<() => void>();

  /** Event raised after IModelApp [[startup]] completes. */
  public static readonly onAfterStartup = new BeEvent<() => void>();

  /** The AuthorizationClient used to obtain [AccessToken]($bentley)s. */
  public static authorizationClient?: AuthorizationClient;
  /** The [[ToolRegistry]] for this session. */
  public static readonly tools = new ToolRegistry();
  /** A uniqueId for this session */
  public static sessionId: GuidString;
  /** The [[MapLayerFormatRegistry]] for this session. */
  public static get mapLayerFormatRegistry(): MapLayerFormatRegistry { return this._mapLayerFormatRegistry; }
  /** The [[TerrainProviderRegistry]] for this session. */
  public static get terrainProviderRegistry(): TerrainProviderRegistry { return this._terrainProviderRegistry; }
  /** The [[RealityDataSourceProviderRegistry]] for this session.
   * @alpha
   */
  public static get realityDataSourceProviders(): RealityDataSourceProviderRegistry { return this._realityDataSourceProviders; }
  /** The [[RenderSystem]] for this session. */
  public static get renderSystem(): RenderSystem { return this._renderSystem!; }
  /** The [[ViewManager]] for this session. */
  public static get viewManager(): ViewManager { return this._viewManager; }
  /** The [[NotificationManager]] for this session. */
  public static get notifications(): NotificationManager { return this._notifications; }
  /** The [[TileAdmin]] for this session. */
  public static get tileAdmin(): TileAdmin { return this._tileAdmin; }
  /** The [[QuantityFormatter]] for this session. */
  public static get quantityFormatter(): QuantityFormatter { return this._quantityFormatter; }
  /** The [[ToolAdmin]] for this session. */
  public static get toolAdmin(): ToolAdmin { return this._toolAdmin; }
  /** The [[AccuDraw]] for this session. */
  public static get accuDraw(): AccuDraw { return this._accuDraw; }
  /** The [[AccuSnap]] for this session. */
  public static get accuSnap(): AccuSnap { return this._accuSnap; }
  public static get locateManager(): ElementLocateManager { return this._locateManager; }
  /** The [[TentativePoint]] for this session]]. */
  public static get tentativePoint(): TentativePoint { return this._tentativePoint; }
  /** The [[Localization]] for this session. */
  public static get localization(): Localization { return this._localization; }
  /** The [[UserPreferencesAccess]] for this session.
   * @beta
   */
  public static get userPreferences(): UserPreferencesAccess | undefined { return this._userPreferences; }
  /** The Id of this application. Applications must set this to the Global Product Registry ID (GPRID) for usage logging. */
  public static get applicationId(): string { return this._applicationId; }
  /** The version of this application. Must be set for usage logging. */
  public static get applicationVersion(): string { return this._applicationVersion; }
  /** True after [[startup]] has been called, until [[shutdown]] is called. */
  public static get initialized() { return this._initialized; }

  /** Provides access to IModelHub services. */
  public static get hubAccess(): FrontendHubAccess | undefined { return this._hubAccess; }

  /** Provides access to the RealityData service implementation for this IModelApp
   * @beta
   */
  public static get realityDataAccess(): RealityDataAccess | undefined { return this._realityDataAccess; }

  /** Whether the [renderSystem[]] has been successfully initialized.
   * This will always be `false` before calling [[startup]] and after calling [[shutdown]].
   * In rare circumstances (e.g., while executing in a headless test environment) it may remain `false` due to a failure to
   * obtain a [WebGL rendering context](https://www.google.com/search?channel=fs&client=ubuntu-sn&q=mdn+webglrenderingcontext).
   * As long as you have called [[startup]], you can generally assume it to be `true`.
   */
  public static get hasRenderSystem() {
    return this._renderSystem !== undefined && this._renderSystem.isValid;
  }

  /** The [[UiAdmin]] for this session. */
  public static get uiAdmin() { return this._uiAdmin; }
  /** The requested security options for the frontend. */
  public static get securityOptions() { return this._securityOptions; }

  /** If present, overrides where public assets are fetched. The default is to fetch assets relative to the current URL.
   * The path should always end with a trailing `/`.
   */
  public static get publicPath() { return this._publicPath; }

  /** The [[TelemetryManager]] for this session
   * @internal
   */
  public static readonly telemetry: TelemetryManager = new TelemetryManager();

  /** @alpha */
  public static readonly extensionAdmin = this._createExtensionAdmin();

  /** Map of classFullName to EntityState class */
  private static _entityClasses = new Map<string, typeof EntityState>();

  /** Register all of the subclasses of EntityState from a module.
   * @internal
   */
  public static registerModuleEntities(moduleObj: any) {
    for (const thisMember in moduleObj) { // eslint-disable-line guard-for-in
      const thisEntityState = moduleObj[thisMember];
      if (thisEntityState.prototype instanceof EntityState) {
        this.registerEntityState(thisEntityState.classFullName, thisEntityState);
      }
    }
  }

  /** Register an EntityState class by its classFullName
   * @internal
   */
  public static registerEntityState(classFullName: string, classType: typeof EntityState) {
    const lowerName = classFullName.toLowerCase();
    if (this._entityClasses.has(lowerName)) {
      const errMsg = `Class ${classFullName} is already registered. Make sure static schemaName and className members are correct on class ${classType.name}`;
      Logger.logError(FrontendLoggerCategory.IModelConnection, errMsg);
      throw new Error(errMsg);
    }

    this._entityClasses.set(lowerName, classType);
  }

  /** @internal */
  public static lookupEntityClass(classFullName: string) { return this._entityClasses.get(classFullName.toLowerCase()); }

  /**
   * Obtain WebGL rendering compatibility information for the client system.  This information describes whether the client meets the
   * minimum rendering capabilities.  It also describes whether the system lacks any optional capabilities that could improve quality
   * and/or performance.
   * @note As of 4.x, iTwin.js requires WebGL 2. If the client does not support WebGL 2, the `status` field of the returned compatibility info will be [WebGLRenderCompatibilityStatus.CannotCreateContext]($webgl-compatibility).
   */
  public static queryRenderCompatibility(): WebGLRenderCompatibilityInfo {
    return queryRenderCompatibility(true, (canvas, useWebGL2, inputContextAttributes) => System.createContext(canvas, useWebGL2, inputContextAttributes));
  }

  /**
   * This method must be called before any other `@itwin/core-frontend` methods are used.
   * Somewhere in your startup code, call [[IModelApp.startup]]. E.g.:
   * ``` ts
   * await IModelApp.startup( {applicationId: myAppId} );
   * ```
   * @param opts The options for configuring IModelApp
   */
  public static async startup(opts?: IModelAppOptions): Promise<void> {
    if (this._initialized)
      return; // we're already initialized, do nothing.
    this._initialized = true;

    opts = opts ?? {};
    this._securityOptions = opts.security ?? {};

    if (process.env.NODE_ENV === "development") {
      // Make IModelApp globally accessible for debugging purposes. We'll remove it on shutdown.
      (window as IModelAppForDebugger).iModelAppForDebugger = this;
    }

    this.sessionId = opts.sessionId ?? Guid.createValue();
    this._applicationId = opts.applicationId ?? "2686";  // Default to product id of iTwin.js
    this._applicationVersion = opts.applicationVersion ?? "1.0.0";
    this.authorizationClient = opts.authorizationClient;
    this._hubAccess = opts.hubAccess;
    this._noRender = opts.noRender ?? false;

    this._setupRpcRequestContext();

    this._localization = opts.localization ?? new ITwinLocalization();
    const toolsNs = "CoreTools";
    await this.localization.initialize(["iModelJs", toolsNs]);
    [
      selectTool,
      idleTool,
      viewTool,
      clipViewTool,
      measureTool,
      accudrawTool,
    ].forEach((tool) => this.tools.registerModule(tool, toolsNs));

    this.registerEntityState(EntityState.classFullName, EntityState);
    [
      modelState,
      sheetState,
      viewState,
      drawingViewState,
      spatialViewState,
      displayStyleState,
      modelselector,
      categorySelectorState,
      auxCoordState,
    ].forEach((module) => this.registerModuleEntities(module));

    this._renderSystem = (opts.renderSys instanceof RenderSystem) ? opts.renderSys : this.createRenderSys(opts.renderSys);
    if (opts.userPreferences)
      this._userPreferences = opts.userPreferences;
    this._viewManager = opts.viewManager ?? new ViewManager();
    this._tileAdmin = await TileAdmin.create(opts.tileAdmin);
    this._notifications = opts.notifications ?? new NotificationManager();
    this._toolAdmin = opts.toolAdmin ?? new ToolAdmin();
    this._accuDraw = opts.accuDraw ?? new AccuDraw();
    this._accuSnap = opts.accuSnap ?? new AccuSnap();
    this._locateManager = opts.locateManager ?? new ElementLocateManager();
    this._tentativePoint = opts.tentativePoint ?? new TentativePoint();
    this._quantityFormatter = opts.quantityFormatter ?? new QuantityFormatter();
    this._uiAdmin = opts.uiAdmin ?? new UiAdmin();
    this._mapLayerFormatRegistry = new MapLayerFormatRegistry(opts.mapLayerOptions);
    this._terrainProviderRegistry = new TerrainProviderRegistry();
    this._realityDataSourceProviders = new RealityDataSourceProviderRegistry();
    this._realityDataAccess = opts.realityDataAccess;
    this._publicPath = opts.publicPath ?? "";

    [
      this.renderSystem,
      this.viewManager,
      this.toolAdmin,
      this.accuDraw,
      this.accuSnap,
      this.locateManager,
      this.tentativePoint,
      this.uiAdmin,
    ].forEach((sys) => sys.onInitialized());

    await this.quantityFormatter.onInitialized();
    this.onAfterStartup.raiseEvent();
  }

  /** Must be called before the application exits to release any held resources. */
  public static async shutdown() {
    if (!this._initialized)
      return;

    // notify listeners that this IModelApp is about to be shut down.
    this.onBeforeShutdown.raiseEvent();
    this.onBeforeShutdown.clear();

    if (process.env.NODE_ENV === "development") {
      (window as IModelAppForDebugger).iModelAppForDebugger = undefined;
    }

    this._wantEventLoop = false;
    window.removeEventListener("resize", () => IModelApp.requestNextAnimation());
    this.clearIntervalAnimation();
    [this.toolAdmin, this.viewManager, this.tileAdmin].forEach((sys) => sys.onShutDown());
    this.tools.shutdown();
    this._renderSystem = dispose(this._renderSystem);
    this._entityClasses.clear();
    this.authorizationClient = undefined;
    this._initialized = false;
    this.onAfterStartup.clear();
  }

  /** Controls how frequently the application polls for changes that may require a new animation frame to be requested.
   * Such changes include resizing a Viewport or changing the device pixel ratio by zooming in or out in the browser.
   * The default interval is 1 second. It may be desirable to override the default for specific apps and/or devices.
   *  - Increasing the interval can conserve battery life on battery-powered devices at the expense of slower response to resize events.
   *  - An application that only displays a single Viewport whose dimensions only change when the dimensions of the application window change, and which does not support changing application zoom level, could disable the interval altogether.
   * @param interval The interval at which to poll for changes. If undefined (or negative), the application will never poll. If zero, the application will poll as frequently as possible.
   * @beta
   */
  public static get animationInterval(): BeDuration | undefined { return IModelApp._animationInterval; }
  public static set animationInterval(interval: BeDuration | undefined) {
    if (undefined !== interval && interval.isTowardsPast)
      interval = undefined;

    if (interval !== IModelApp._animationInterval) {
      IModelApp._animationInterval = interval;
      if (IModelApp._wantEventLoop)
        IModelApp.requestIntervalAnimation();
    }
  }

  /** Request that the event loop execute on the next [animation frame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame).
   * There is generally no reason for applications to invoke this method directly.
   */
  public static requestNextAnimation() {
    // Only want to call requestAnimationFrame if it is defined. Need to check whether current iModelApp is a NoRenderApp.
    if (IModelApp._noRender)
      return;

    if (!IModelApp._animationRequested) {
      IModelApp._animationRequested = true;
      requestAnimationFrame(() => IModelApp.eventLoop());
    }
  }

  /** @internal */
  private static clearIntervalAnimation(): void {
    if (undefined !== IModelApp._animationIntervalId) {
      window.clearInterval(IModelApp._animationIntervalId);
      IModelApp._animationIntervalId = undefined;
    }
  }

  /** @internal */
  private static requestIntervalAnimation(): void {
    IModelApp.clearIntervalAnimation();

    if (undefined !== IModelApp.animationInterval)
      IModelApp._animationIntervalId = window.setInterval(() => {
        IModelApp.requestNextAnimation();
      }, IModelApp.animationInterval.milliseconds);
  }

  /** @internal */
  public static startEventLoop() {
    if (!IModelApp._wantEventLoop) {
      IModelApp._wantEventLoop = true;
      window.addEventListener("resize", () => IModelApp.requestNextAnimation());
      IModelApp.requestIntervalAnimation();
      IModelApp.requestNextAnimation();
    }
  }

  /** Strictly for tests. @internal */
  public static stopEventLoop() {
    this._wantEventLoop = false;
  }

  /** The main event processing loop for Tools and rendering. */
  private static eventLoop() {
    IModelApp._animationRequested = false;
    if (!IModelApp._wantEventLoop) // flag turned on at startup
      return;

    try {
      IModelApp.toolAdmin.processEvent(); // eslint-disable-line @typescript-eslint/no-floating-promises
      IModelApp.viewManager.renderLoop();
      IModelApp.tileAdmin.process();
    } catch (exception) {
      ToolAdmin.exceptionHandler(exception); // eslint-disable-line @typescript-eslint/no-floating-promises

      IModelApp._wantEventLoop = false;
      IModelApp._animationRequested = true; // unrecoverable after exception, don't request any further frames.
      window.removeEventListener("resize", () => IModelApp.requestNextAnimation());
    }
  }

  /** Get the user's access token for this IModelApp, or a blank string if none is available.
   * @note Access tokens expire periodically and are automatically refreshed, if possible. Therefore tokens should not be saved, and the value
   * returned by this method may change over time throughout the course of a session.
   */
  public static async getAccessToken(): Promise<AccessToken> {
    try {
      return (await this.authorizationClient?.getAccessToken()) ?? "";
    } catch {
      return "";
    }
  }

  /** @internal */
  public static createRenderSys(opts?: RenderSystem.Options): RenderSystem { return System.create(opts); }

  private static _setupRpcRequestContext() {
    RpcConfiguration.requestContext.getId = (_request: RpcRequest): string => {
      return Guid.createValue();
    };

    RpcConfiguration.requestContext.serialize = async (_request: RpcRequest): Promise<SerializedRpcActivity> => {
      const id = _request.id;
      const serialized: SerializedRpcActivity = {
        id,
        applicationId: this.applicationId,
        applicationVersion: this.applicationVersion,
        sessionId: this.sessionId,
        authorization: ProcessDetector.isMobileAppFrontend ? "" : await this.getAccessToken(),
      };

      const csrf = IModelApp.securityOptions.csrfProtection;
      if (csrf && csrf.enabled) {
        const cookieName = csrf.cookieName || "XSRF-TOKEN";
        const cookieValue = document.cookie.split("; ").find((r) => r.startsWith(`${cookieName}=`));

        if (cookieValue) {
          const headerName = csrf.headerName || "X-XSRF-TOKEN";
          const headerValue = cookieValue.split("=")[1];
          serialized.csrfToken = { headerName, headerValue };
        }
      }

      return serialized;
    };
  }

  /** Shortcut for creating an HTMLElement with optional parent, className, id, innerHTML, innerText. */
  public static makeHTMLElement<K extends keyof HTMLElementTagNameMap>(type: K, opt?: {
    /** The parent for the new HTMLElement */
    parent?: HTMLElement;
    /** The className for the new HTMLElement */
    className?: string;
    /** The Id for the new HTMLElement */
    id?: string;
    /** innerHTML for the new HTMLElement */
    innerHTML?: string;
    /** innerText for the new HTMLElement */
    innerText?: string;
  }) {
    const el = document.createElement(type);
    if (undefined !== opt) {
      if (undefined !== opt.className)
        el.className = opt.className;
      if (undefined !== opt.id)
        el.id = opt.id;
      if (undefined !== opt.innerHTML)
        el.innerHTML = opt.innerHTML;
      if (undefined !== opt.innerText)
        el.innerText = opt.innerText;
      if (undefined !== opt.parent)
        opt.parent.appendChild(el);
    }
    return el;
  }

  /** Shortcut for making a modal dialog on top of the root of the application. The returned HTMLDivElement will be placed topmost, all other application
   * windows will be covered with a semi-transparent background that intercepts all key/mouse/touch events until the modal is dismissed.
   * @param options The options that describe how the modal should work.
   */
  public static makeModalDiv(options: ModalOptions): ModalReturn {
    const root = options.rootDiv ? options.rootDiv : document.body;
    // create the overlay div to "black out" the application to indicate everything is inactive until the modal has been dismissed.
    const overlay = IModelApp.makeHTMLElement("div", { parent: root, className: "imodeljs-modal-overlay" });
    overlay.tabIndex = -1; // so we can catch keystroke events

    // function to remove modal dialog
    const stop = (ev: Event) => {
      root.removeChild(overlay);
      ev.stopPropagation();
    };

    if (options.autoClose) {
      overlay.onclick = overlay.oncontextmenu = stop;
      overlay.onkeydown = overlay.onkeyup = (ev: KeyboardEvent) => { // ignore all keystrokes other than enter and escape
        switch (ev.key) {
          case "Enter":
          case "Escape":
            stop(ev);
            return;
        }
        ev.stopPropagation();
      };
      overlay.focus();
    }

    const modal = IModelApp.makeHTMLElement("div", { parent: overlay, className: "imodeljs-modal" });
    if (undefined !== options.width) {
      modal.style.width = `${options.width}px`;
      // allow the dialog to be smaller than the width
      modal.style.maxWidth = `min(100% - (2 * var(--width-border)), ${options.width}px)`;
    }
    if (options.closeBox) {
      const close = IModelApp.makeHTMLElement("p", { parent: modal, className: "imodeljs-modal-close" });
      close.innerText = "\u00d7"; // unicode "times" symbol
      close.onclick = stop;
    }

    return { modal, stop };
  }

  /** Applications may implement this method to supply a Logo Card.
   * @beta
   */
  public static applicationLogoCard?: () => HTMLTableRowElement;

  /** Make a new Logo Card. Call this method from your implementation of [[IModelApp.applicationLogoCard]]
   * @param opts Options for Logo Card
   * @beta
   */
  public static makeLogoCard(
    opts: {
      /** The heading to be put at the top of this logo card inside an <h2>. May include HTML. */
      heading: string | HTMLElement;
      /** The URL or HTMLImageElement for the icon on this logo card. */
      iconSrc?: string | HTMLImageElement;
      /** The width of the icon, if `iconSrc` is a string. Default is 64. */
      iconWidth?: number;
      /** A *notice* string to be shown on the logo card. May include HTML.  */
      notice?: string | HTMLElement;
    }): HTMLTableRowElement {
    const card = IModelApp.makeHTMLElement("tr");
    const iconCell = IModelApp.makeHTMLElement("td", { parent: card, className: "logo-card-logo" });
    if (undefined !== opts.iconSrc) {
      if (typeof opts.iconSrc === "string") {
        const logo = IModelApp.makeHTMLElement("img");
        logo.src = opts.iconSrc;
        logo.width = opts.iconWidth ? opts.iconWidth : 64;
        opts.iconSrc = logo;
      }
      iconCell.appendChild(opts.iconSrc);
    }
    const noticeCell = IModelApp.makeHTMLElement("td", { parent: card, className: "logo-card-message" });
    if (undefined !== opts.heading) {
      if (typeof opts.heading === "string")
        IModelApp.makeHTMLElement("h2", { parent: noticeCell, innerHTML: opts.heading, className: "logo-card-header" });
      else
        noticeCell.appendChild(opts.heading);
    }
    if (undefined !== opts.notice) {
      if (typeof opts.notice === "string")
        IModelApp.makeHTMLElement("p", { parent: noticeCell, innerHTML: opts.notice, className: "logo-cards" });
      else
        noticeCell.appendChild(opts.notice);
    }
    return card;
  }

  /** Make the logo card for the library itself. This card gets placed at the top of the stack.
   *  @internal
   */
  public static makeIModelJsLogoCard() {
    return this.makeLogoCard({
      iconSrc: `${this.publicPath}images/about-imodeljs.svg`,
      heading: `<span style="font-weight:normal">${this.localization.getLocalizedString("iModelJs:Notices.PoweredBy")}</span>&nbsp;iTwin.js`,
      notice: `${ITWINJS_CORE_VERSION}<br>${COPYRIGHT_NOTICE}`,
    });
  }

  /** Format the tooltip strings returned by [[IModelConnection.getToolTipMessage]].
   * @alpha
   */
  public static formatElementToolTip(msg: string[]): HTMLElement {
    let out = "";
    msg.forEach((line) => out += `${IModelApp.localization?.getLocalizedKeys(line)}<br>`);
    const div = document.createElement("div");
    div.innerHTML = out;
    return div;
  }

  /** Localize an error status
   * @param status one of the status values from [BentleyStatus]($core-bentley), [IModelStatus]($core-bentley) or [DbResult]($core-bentley)
   * @returns a localized error message
   * @beta
   */
  public static translateStatus(status: number) {
    let key: { scope: string, val: string, status?: string };
    if (typeof status !== "number") {
      key = { scope: "Errors", val: "IllegalValue" };
    } else {
      key = { scope: "BentleyStatus", val: BentleyStatus[status] };
      if (!key.val)
        key = { scope: "IModelStatus", val: IModelStatus[status] };
      if (!key.val)
        key = { scope: "DbResult", val: DbResult[status] };
      if (!key.val)
        key = { scope: "Errors", val: "Status", status: status.toString() };
    }

    return this.localization.getLocalizedString(`iModelJs:${key.scope}.${key.val}`, key);
  }

  /**
   * Creates an instance of the ExtensionAdmin
   * and registers an event to execute after startup is complete
   * @returns an instance of ExtensionAdmin
   */
  private static _createExtensionAdmin(): ExtensionAdmin {
    const extensionAdmin = new ExtensionAdmin();
    IModelApp.onAfterStartup.addListener(extensionAdmin.onStartup);
    return extensionAdmin;
  }
}
