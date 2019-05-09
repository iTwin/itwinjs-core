/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelApp */

import { dispose, Guid, GuidString, ClientRequestContext, SerializedClientRequestContext } from "@bentley/bentleyjs-core";
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
import { TileAdmin } from "./tile/TileAdmin";
import { EntityState } from "./EntityState";

import * as idleTool from "./tools/IdleTool";
import * as selectTool from "./tools/SelectTool";
import * as pluginTool from "./tools/PluginTool";
import * as viewTool from "./tools/ViewTool";
import * as clipViewTool from "./tools/ClipViewTool";
import * as measureTool from "./tools/MeasureTool";
import * as modelState from "./ModelState";
import * as sheetState from "./Sheet";
import * as viewState from "./ViewState";
import * as displayStyleState from "./DisplayStyleState";
import * as modelselector from "./ModelSelectorState";
import * as categorySelectorState from "./CategorySelectorState";
import * as auxCoordState from "./AuxCoordSys";

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
  /** If present, supplies the [[AccuDraw]] for this session. */
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
}

/**
 * Global singleton that connects the user interface with the iModel.js services. There can be only one IModelApp active in a session. All
 * members of IModelApp are static, and it serves as a singleton object for gaining access to session information.
 *
 * Before any interactive operations may be performed by the @bentley/imodeljs-frontend package, [[IModelApp.startup]] must be called.
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
  private static _quantityFormatter: QuantityFormatter;
  private static _renderSystem?: RenderSystem;
  private static _settings: SettingsAdmin;
  private static _tentativePoint: TentativePoint;
  private static _tileAdmin: TileAdmin;
  private static _toolAdmin: ToolAdmin;
  private static _viewManager: ViewManager;

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
  /** The [[AccuDraw]] for this session. */
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

  /** Map of classFullName to EntityState class */
  private static _entityClasses = new Map<string, typeof EntityState>();

  /** Register all of the subclasses of EntityState from a module.
   * @internal
   */
  public static registerModuleEntities(moduleObj: any) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

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
    if (this._entityClasses.has(lowerName))
      throw new Error("Class " + classFullName + " is already registered. Make sure static schemaName and className members are correct on class " + classType.name);

    this._entityClasses.set(lowerName, classType);
  }

  /** @internal */
  public static lookupEntityClass(classFullName: string) { return this._entityClasses.get(classFullName.toLowerCase()); }

  /**
   * This method must be called before any iModel.js frontend services are used.
   * In your code, somewhere before you use any iModel.js services, call IModelApp.startup. E.g.:
   * ``` ts
   * IModelApp.startup({applicationId: myAppId, i18n: myi18Opts});
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
    this._applicationVersion = (opts.applicationVersion !== undefined) ? opts.applicationVersion : (typeof (BUILD_SEMVER) !== "undefined" ? BUILD_SEMVER : "");
    this.authorizationClient = opts.authorizationClient;

    this._imodelClient = (opts.imodelClient !== undefined) ? opts.imodelClient : new IModelHubClient();

    this._setupRpcRequestContext();

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    this._i18n = (opts.i18n instanceof I18N) ? opts.i18n : new I18N(["iModelJs"], "iModelJs", opts.i18n);

    const tools = this.tools; // first register all the core tools. Subclasses may choose to override them.
    const coreNamespace = this.i18n.registerNamespace("CoreTools");
    tools.registerModule(selectTool, coreNamespace);
    tools.registerModule(idleTool, coreNamespace);
    tools.registerModule(viewTool, coreNamespace);
    tools.registerModule(clipViewTool, coreNamespace);
    tools.registerModule(measureTool, coreNamespace);
    tools.registerModule(pluginTool, coreNamespace);

    this.registerEntityState(EntityState.classFullName, EntityState);
    this.registerModuleEntities(modelState);
    this.registerModuleEntities(sheetState);
    this.registerModuleEntities(viewState);
    this.registerModuleEntities(displayStyleState);
    this.registerModuleEntities(modelselector);
    this.registerModuleEntities(categorySelectorState);
    this.registerModuleEntities(auxCoordState);

    this._renderSystem = (opts.renderSys instanceof RenderSystem) ? opts.renderSys : this.createRenderSys(opts.renderSys);

    // the startup function may have already allocated any of these members, so first test whether they're present
    this._settings = (opts.settings !== undefined) ? opts.settings : new ConnectSettingsClient(this.applicationId);
    this._viewManager = (opts.viewManager !== undefined) ? opts.viewManager : new ViewManager();
    this._tileAdmin = (opts.tileAdmin !== undefined) ? opts.tileAdmin : TileAdmin.create();
    this._notifications = (opts.notifications !== undefined) ? opts.notifications : new NotificationManager();
    this._toolAdmin = (opts.toolAdmin !== undefined) ? opts.toolAdmin : new ToolAdmin();
    this._accuDraw = (opts.accuDraw !== undefined) ? opts.accuDraw : new AccuDraw();
    this._accuSnap = (opts.accuSnap !== undefined) ? opts.accuSnap : new AccuSnap();
    this._locateManager = (opts.locateManager !== undefined) ? opts.locateManager : new ElementLocateManager();
    this._tentativePoint = (opts.tentativePoint !== undefined) ? opts.tentativePoint : new TentativePoint();
    this._quantityFormatter = (opts.quantityFormatter !== undefined) ? opts.quantityFormatter : new QuantityFormatter();

    this.renderSystem.onInitialized();
    this.viewManager.onInitialized();
    this.toolAdmin.onInitialized();
    this.accuDraw.onInitialized();
    this.accuSnap.onInitialized();
    this.locateManager.onInitialized();
    this.tentativePoint.onInitialized();
  }

  /** Must be called before the application exits to release any held resources. */
  public static shutdown() {
    if (this._initialized) {
      this.toolAdmin.onShutDown();
      this.viewManager.onShutDown();
      this.tileAdmin.onShutDown();
      this._renderSystem = dispose(this._renderSystem);
      this._entityClasses.clear();
      this._initialized = false;
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
        userId = accessToken.getUserInfo()!.id;
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
}
