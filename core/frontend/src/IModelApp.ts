/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelApp */

const copyrightNotice = 'Copyright © 2017-2019 <a href="https://www.bentley.com" target="_blank" rel="noopener noreferrer">Bentley Systems, Inc.</a>';

import { dispose, Guid, GuidString, ClientRequestContext, SerializedClientRequestContext, Logger, BeDuration, BeTimePoint } from "@bentley/bentleyjs-core";
import {
  AccessToken, ConnectSettingsClient, IModelClient, IModelHubClient,
  SettingsAdmin, IAuthorizationClient, IncludePrefix,
} from "@bentley/imodeljs-clients";
import { IModelError, IModelStatus, RpcConfiguration, RpcRequest } from "@bentley/imodeljs-common";
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { AccuSnap } from "./AccuSnap";
import { AccuDraw } from "./AccuDraw";
import { ElementLocateManager } from "./ElementLocateManager";
import { NotificationManager } from "./NotificationManager";
import { QuantityFormatter } from "./QuantityFormatter";
import { FrontendRequestContext } from "./FrontendRequestContext";
import { RenderSystem } from "./render/System";
import { System } from "./render/webgl/System";
import { TentativePoint } from "./TentativePoint";
import { ToolRegistry } from "./tools/Tool";
import { ToolAdmin } from "./tools/ToolAdmin";
import { ViewManager } from "./ViewManager";
import { WebGLRenderCompatibilityInfo } from "./RenderCompatibility";
import { TileAdmin } from "./tile/TileAdmin";
import { EntityState } from "./EntityState";
import { TerrainProvider } from "./TerrainProvider";
import { FrontendLoggerCategory } from "./FrontendLoggerCategory";
import { PluginAdmin } from "./plugin/Plugin";
import { UiAdmin } from "@bentley/ui-abstract";
import { FeatureTrackingManager } from "./FeatureTrackingManager";

import * as idleTool from "./tools/IdleTool";
import * as selectTool from "./tools/SelectTool";
import * as pluginTool from "./tools/PluginTool";
import * as viewTool from "./tools/ViewTool";
import * as clipViewTool from "./tools/ClipViewTool";
import * as measureTool from "./tools/MeasureTool";
import * as accudrawTool from "./tools/AccuDrawTool";
import * as modelState from "./ModelState";
import * as sheetState from "./Sheet";
import * as viewState from "./ViewState";
import * as displayStyleState from "./DisplayStyleState";
import * as modelselector from "./ModelSelectorState";
import * as categorySelectorState from "./CategorySelectorState";
import * as auxCoordState from "./AuxCoordSys";

// tslint:disable-next-line: no-var-requires
require("./IModeljs-css");

// cSpell:ignore noopener noreferrer gprid forin nbsp

declare var BUILD_SEMVER: string;

/** Options that can be supplied to [[IModelApp.startup]] to customize frontend behavior.
 * @public
 */
export interface IModelAppOptions {
  /** If present, supplies the [[IModelClient]] for this session. */
  imodelClient?: IModelClient;
  /** If present, supplies the Id of this application. Applications must set this to the Bentley Global Product Registry Id (GPRID) for usage logging. */
  applicationId?: string;
  /** If present, supplies the version of this application. Must be set for usage logging. */
  applicationVersion?: string;
  /** If present, supplies the [[SettingsAdmin]] for this session. */
  settings?: SettingsAdmin;
  /** If present, supplies the [[ViewManager]] for this session. */
  viewManager?: ViewManager;
  /** If present, supplies the [[TileAdmin]] for this session.
   * @alpha
   */
  tileAdmin?: TileAdmin;
  /** If present, supplies the [[NotificationManager]] for this session. */
  notifications?: NotificationManager;
  /** If present, supplies the [[ToolAdmin]] for this session. */
  toolAdmin?: ToolAdmin;
  /** If present, supplies the [[AccuDraw]] for this session.
   * @internal
   */
  accuDraw?: AccuDraw;
  /** If present, supplies the [[AccuSnap]] for this session. */
  accuSnap?: AccuSnap;
  /** If present, supplies the [[I18N]] for this session. May be either an I18N instance or an I18NOptions used to create an I18N */
  i18n?: I18N | I18NOptions;
  /** If present, supplies the authorization information for various frontend APIs */
  authorizationClient?: IAuthorizationClient;
  /** @internal */
  sessionId?: GuidString;
  /** @internal */
  locateManager?: ElementLocateManager;
  /** @internal */
  tentativePoint?: TentativePoint;
  /** @internal */
  quantityFormatter?: QuantityFormatter;
  /** @internal */
  renderSys?: RenderSystem | RenderSystem.Options;
  /** @internal */
  terrainProvider?: TerrainProvider;
  /** @internal */
  pluginAdmin?: PluginAdmin;
  /** If present, supplies the [[UiAdmin]] for this session. */
  uiAdmin?: UiAdmin;
  /** if present, supplies the [[FeatureTrackingManager]] for this session */
  features?: FeatureTrackingManager;
}

/** Options for [[IModelApp.makeModalDiv]]
 *  @internal
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
 * @internal
 */
export interface ModalReturn {
  /** The modal HTMLDivElement created. */
  modal: HTMLDivElement;
  /** A function that can be set as an event handler to stop the modal dialog. This can be used if `autoClose` or `closeBox` are not enabled. */
  stop: (_ev: Event) => void;
}

/**
 * Global singleton that connects the user interface with the iModel.js services. There can be only one IModelApp active in a session. All
 * members of IModelApp are static, and it serves as a singleton object for gaining access to session information.
 *
 * Before any interactive operations may be performed by the `@bentley/imodeljs-frontend package`, [[IModelApp.startup]] must be called.
 * Applications may customize the frontend behavior of iModel.js by supplying options to [[IModelApp.startup]].
 *
 * @public
 */
export class IModelApp {
  private static _initialized = false;
  private static _accuDraw: AccuDraw;
  private static _accuSnap: AccuSnap;
  private static _applicationId: string;
  private static _applicationVersion: string;
  private static _i18n: I18N;
  private static _imodelClient: IModelClient;
  private static _locateManager: ElementLocateManager;
  private static _notifications: NotificationManager;
  private static _pluginAdmin: PluginAdmin;
  private static _quantityFormatter: QuantityFormatter;
  private static _renderSystem?: RenderSystem;
  private static _settings: SettingsAdmin;
  private static _tentativePoint: TentativePoint;
  private static _tileAdmin: TileAdmin;
  private static _toolAdmin: ToolAdmin;
  private static _terrainProvider?: TerrainProvider;
  private static _viewManager: ViewManager;
  private static _uiAdmin: UiAdmin;
  private static _wantEventLoop = false;
  private static _animationRequested = false;
  private static _animationInterval: BeDuration | undefined = BeDuration.fromSeconds(1);
  private static _animationIntervalId?: number;
  private static _tileTreePurgeTime?: BeTimePoint;
  private static _tileTreePurgeInterval?: BeDuration;
  private static _features: FeatureTrackingManager;

  // No instances or subclasses of IModelApp may be created. All members are static and must be on the singleton object IModelApp.
  private constructor() { }

  /** Provides authorization information for various frontend APIs */
  public static authorizationClient?: IAuthorizationClient;
  /** The [[ToolRegistry]] for this session. */
  public static readonly tools = new ToolRegistry();
  /** A uniqueId for this session */
  public static sessionId: GuidString;
  /** The [[RenderSystem]] for this session. */
  public static get renderSystem(): RenderSystem { return this._renderSystem!; }
  /** The [[ViewManager]] for this session. */
  public static get viewManager(): ViewManager { return this._viewManager; }
  /** The [[NotificationManager]] for this session. */
  public static get notifications(): NotificationManager { return this._notifications; }
  /** The [[TileAdmin]] for this session.
   * @alpha
   */
  public static get tileAdmin(): TileAdmin { return this._tileAdmin; }
  /** The [[QuantityFormatter]] for this session.
   * @alpha
   */
  public static get quantityFormatter(): QuantityFormatter { return this._quantityFormatter; }
  /** The [[ToolAdmin]] for this session. */
  public static get toolAdmin(): ToolAdmin { return this._toolAdmin; }
  /** The [[AccuDraw]] for this session.
   * @internal
   */
  public static get accuDraw(): AccuDraw { return this._accuDraw; }
  /** The [[AccuSnap]] for this session. */
  public static get accuSnap(): AccuSnap { return this._accuSnap; }
  /** @internal */
  public static get locateManager(): ElementLocateManager { return this._locateManager; }
  /** @internal */
  public static get tentativePoint(): TentativePoint { return this._tentativePoint; }
  /** The [[I18N]] for this session. */
  public static get i18n(): I18N { return this._i18n; }
  /** The [[SettingsAdmin]] for this session. */
  public static get settings(): SettingsAdmin { return this._settings; }
  /** The Id of this application. Applications must set this to the Global Product Registry ID (GPRID) for usage logging. */
  public static get applicationId(): string { return this._applicationId; }
  /** The version of this application. Must be set for usage logging. */
  public static get applicationVersion(): string { return this._applicationVersion; }
  /** @internal */
  public static get initialized() { return this._initialized; }
  /** The [[IModelClient]] for this session. */
  public static get iModelClient(): IModelClient { return this._imodelClient; }
  /** @internal */
  public static get hasRenderSystem() { return this._renderSystem !== undefined && this._renderSystem.isValid; }
  /** @internal */
  public static get terrainProvider() { return this._terrainProvider; }
  /** @internal */
  public static get pluginAdmin() { return this._pluginAdmin; }
  /** The [[UiAdmin]] for this session. */
  public static get uiAdmin() { return this._uiAdmin; }
  /** The [[FeatureTrackingManager]] for this session */
  public static get features() { return this._features; }

  /** Map of classFullName to EntityState class */
  private static _entityClasses = new Map<string, typeof EntityState>();

  /** Register all of the subclasses of EntityState from a module.
   * @internal
   */
  public static registerModuleEntities(moduleObj: any) {
    for (const thisMember in moduleObj) { // tslint:disable-line: forin
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
      const errMsg = "Class " + classFullName + " is already registered. Make sure static schemaName and className members are correct on class " + classType.name;
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
   * @beta
   */
  public static queryRenderCompatibility(): WebGLRenderCompatibilityInfo { return System.queryRenderCompatibility(); }

  /**
   * This method must be called before any iModel.js frontend services are used.
   * In your code, somewhere before you use any iModel.js services, call [[IModelApp.startup]]. E.g.:
   * ``` ts
   * IModelApp.startup( {applicationId: myAppId, i18n: myi18Opts} );
   * ```
   * @param opts The options for configuring IModelApp
   */
  public static startup(opts?: IModelAppOptions): void {
    opts = opts ? opts : {};

    if (this._initialized)
      throw new IModelError(IModelStatus.AlreadyLoaded, "startup may only be called once");

    // Setup a current context for all requests that originate from this frontend
    const requestContext = new FrontendRequestContext();
    requestContext.enter();

    this._initialized = true;

    // Initialize basic application details before log messages are sent out
    this.sessionId = (opts.sessionId !== undefined) ? opts.sessionId : Guid.createValue();
    this._applicationId = (opts.applicationId !== undefined) ? opts.applicationId : "2686";  // Default to product id of iModel.js
    this._applicationVersion = (opts.applicationVersion !== undefined) ? opts.applicationVersion : (typeof BUILD_SEMVER !== "undefined" ? BUILD_SEMVER : "");
    this.authorizationClient = opts.authorizationClient;

    this._imodelClient = (opts.imodelClient !== undefined) ? opts.imodelClient : new IModelHubClient();

    this._setupRpcRequestContext();

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    this._i18n = (opts.i18n instanceof I18N) ? opts.i18n : new I18N("iModelJs", opts.i18n);

    // first register all the core tools. Subclasses may choose to override them.
    const coreNamespace = this.i18n.registerNamespace("CoreTools");
    [
      selectTool,
      idleTool,
      viewTool,
      clipViewTool,
      measureTool,
      accudrawTool,
      pluginTool,
    ].forEach((tool) => this.tools.registerModule(tool, coreNamespace));

    this.registerEntityState(EntityState.classFullName, EntityState);
    [
      modelState,
      sheetState,
      viewState,
      displayStyleState,
      modelselector,
      categorySelectorState,
      auxCoordState,
    ].forEach((module) => this.registerModuleEntities(module));

    this._renderSystem = (opts.renderSys instanceof RenderSystem) ? opts.renderSys : this.createRenderSys(opts.renderSys);

    this._settings = (opts.settings !== undefined) ? opts.settings : new ConnectSettingsClient(this.applicationId);
    this._viewManager = (opts.viewManager !== undefined) ? opts.viewManager : new ViewManager();
    this._tileAdmin = (opts.tileAdmin !== undefined) ? opts.tileAdmin : TileAdmin.create();
    this._notifications = (opts.notifications !== undefined) ? opts.notifications : new NotificationManager();
    this._toolAdmin = (opts.toolAdmin !== undefined) ? opts.toolAdmin : new ToolAdmin();
    this._accuDraw = (opts.accuDraw !== undefined) ? opts.accuDraw : new AccuDraw();
    this._accuSnap = (opts.accuSnap !== undefined) ? opts.accuSnap : new AccuSnap();
    this._locateManager = (opts.locateManager !== undefined) ? opts.locateManager : new ElementLocateManager();
    this._tentativePoint = (opts.tentativePoint !== undefined) ? opts.tentativePoint : new TentativePoint();
    this._pluginAdmin = (opts.pluginAdmin !== undefined) ? opts.pluginAdmin : new PluginAdmin();
    this._quantityFormatter = (opts.quantityFormatter !== undefined) ? opts.quantityFormatter : new QuantityFormatter();
    this._terrainProvider = opts.terrainProvider;
    this._uiAdmin = (opts.uiAdmin !== undefined) ? opts.uiAdmin : new UiAdmin();
    this._features = (opts.features !== undefined) ? opts.features : new FeatureTrackingManager();

    [
      this.renderSystem,
      this.viewManager,
      this.toolAdmin,
      this.accuDraw,
      this.accuSnap,
      this.locateManager,
      this.tentativePoint,
      this.pluginAdmin,
      this.quantityFormatter,
      this._terrainProvider,
      this.uiAdmin,
    ].forEach((sys) => {
      if (sys)
        sys.onInitialized();
    });
  }

  /** Must be called before the application exits to release any held resources. */
  public static shutdown() {
    if (!this._initialized)
      return;

    this._wantEventLoop = false;
    window.removeEventListener("resize", IModelApp.requestNextAnimation);
    this.clearIntervalAnimation();
    [this.toolAdmin, this.viewManager, this.tileAdmin].forEach((sys) => sys.onShutDown());
    this._renderSystem = dispose(this._renderSystem);
    this._entityClasses.clear();
    this._initialized = false;
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

  /** @internal */
  public static requestNextAnimation() {
    if (!IModelApp._animationRequested) {
      IModelApp._animationRequested = true;
      requestAnimationFrame(IModelApp.eventLoop);
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
      const treeExpirationTime = IModelApp.tileAdmin.tileTreeExpirationTime;
      if (undefined !== treeExpirationTime) {
        IModelApp._tileTreePurgeInterval = treeExpirationTime;
        IModelApp._tileTreePurgeTime = BeTimePoint.now().plus(treeExpirationTime);
      }

      window.addEventListener("resize", IModelApp.requestNextAnimation);
      IModelApp.requestIntervalAnimation();
      IModelApp.requestNextAnimation();
    }
  }

  /** The main event processing loop for Tools and rendering. */
  private static eventLoop() {
    IModelApp._animationRequested = false;
    if (!IModelApp._wantEventLoop) // flag turned on at startup
      return;

    try {
      IModelApp.toolAdmin.processEvent(); // tslint:disable-line:no-floating-promises
      IModelApp.viewManager.renderLoop();
      IModelApp.tileAdmin.process();

      if (undefined !== IModelApp._tileTreePurgeTime && IModelApp._tileTreePurgeTime.milliseconds < Date.now()) {
        const now = BeTimePoint.now();
        IModelApp._tileTreePurgeTime = now.plus(IModelApp._tileTreePurgeInterval!);
        IModelApp.viewManager.purgeTileTrees(now.minus(IModelApp._tileTreePurgeInterval!));
      }
    } catch (exception) {
      ToolAdmin.exceptionHandler(exception).then(() => { // tslint:disable-line:no-floating-promises
        close(); // this does nothing in a web browser, closes electron.
      });

      IModelApp._wantEventLoop = false;
      IModelApp._animationRequested = true; // unrecoverable after exception, don't request any further frames.
      window.removeEventListener("resize", IModelApp.requestNextAnimation);
    }
  }

  /** @internal */
  public static createRenderSys(opts?: RenderSystem.Options): RenderSystem { return System.create(opts); }

  private static _setupRpcRequestContext() {
    RpcConfiguration.requestContext.getId = (_request: RpcRequest): string => {
      const id = ClientRequestContext.current.useContextForRpc ? ClientRequestContext.current.activityId : Guid.createValue(); // Use any context explicitly set for an RPC call if possible
      ClientRequestContext.current.useContextForRpc = false; // Reset flag so it doesn't get used inadvertently for next RPC call
      return id;
    };

    RpcConfiguration.requestContext.serialize = async (_request: RpcRequest): Promise<SerializedClientRequestContext> => {
      const id = _request.id;

      let authorization: string | undefined;
      let userId: string | undefined;
      if (IModelApp.authorizationClient) {
        // todo: need to subscribe to token change events to avoid getting the string equivalent and compute length
        const accessToken: AccessToken = await IModelApp.authorizationClient.getAccessToken();
        authorization = accessToken.toTokenString(IncludePrefix.Yes);
        const userInfo = accessToken.getUserInfo();
        if (userInfo)
          userId = userInfo.id;
      }
      return {
        id,
        applicationId: this.applicationId,
        applicationVersion: this.applicationVersion,
        sessionId: this.sessionId,
        authorization,
        userId,
      };
    };
  }

  /** Shortcut for creating an HTMLElement with optional parent, className, id, innerHTML, innerText
   *  @internal
   */
  public static makeHTMLElement<K extends keyof HTMLElementTagNameMap>(type: K, opt?: {
    /** The parent for the new HTMLElement */
    parent?: HTMLElement,
    /** The className for the new HTMLElement */
    className?: string,
    /** The Id for the new HTMLElement */
    id?: string,
    /** innerHTML for the new HTMLElement */
    innerHTML?: string,
    /** innerText for the new HTMLElement */
    innerText?: string,
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

  /** Make a modal dialog on top of the root of the application. The returned HTMLDivElement will be placed topmost, all other application
   * windows will be covered with a semi-transparent background that intercepts all key/mouse/touch events until the modal is dismissed.
   * @param options The options that describe how the modal should work.
   * @internal
   */
  public static makeModalDiv(options: ModalOptions): ModalReturn {
    const root = options.rootDiv ? options.rootDiv : document.body;
    // create the overlay div to "black out" the application to indicate everything is inactive until the modal has been dismissed.
    const overlay = IModelApp.makeHTMLElement("div", { parent: root, className: "imodeljs-modal-overlay" });
    overlay.tabIndex = -1; // so we can catch keystroke events

    // function to remove modal dialog
    const stop = (ev: Event) => { root.removeChild(overlay); ev.stopPropagation(); };

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
    if (undefined !== options.width)
      modal.style.width = options.width + "px";
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
      heading: string | HTMLElement,
      /** The URL or HTMLImageElement for the icon on this logo card. */
      iconSrc?: string | HTMLImageElement;
      /** The width of the icon, if `iconSrc` is a string. Default is 64. */
      iconWidth?: number;
      /** A *notice* string to be shown on the logo card. May include HTML.  */
      notice?: string | HTMLElement
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
        IModelApp.makeHTMLElement("h2", { parent: noticeCell, innerHTML: opts.heading });
      else
        noticeCell.appendChild(opts.heading);
    }
    if (undefined !== opts.notice) {
      if (typeof opts.notice === "string")
        IModelApp.makeHTMLElement("p", { parent: noticeCell, innerHTML: opts.notice });
      else
        noticeCell.appendChild(opts.notice);
    }
    return card;
  }

  /** Make the logo card for the iModel.js library itself. This card gets placed at the top of the stack.
   *  @internal
   */
  public static makeIModelJsLogoCard() {
    return this.makeLogoCard({
      iconSrc: "images/about-imodeljs.svg",
      heading: `<span style="font-weight:normal">` + this.i18n.translate("Notices.PoweredBy") + "</span>&nbsp;iModel.js",
      notice: this.applicationVersion + "<br>" + copyrightNotice,
    });
  }
}
