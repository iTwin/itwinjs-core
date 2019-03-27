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
import { FeatureGates, IModelError, IModelStatus, RpcConfiguration, RpcRequest } from "@bentley/imodeljs-common";
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
import * as idleTool from "./tools/IdleTool";
import * as selectTool from "./tools/SelectTool";
import * as pluginTool from "./tools/PluginTool";
import * as viewTool from "./tools/ViewTool";
import * as clipViewTool from "./tools/ClipViewTool";
import * as measureTool from "./tools/MeasureTool";

declare var BUILD_SEMVER: string;

/** Creates an *Application* to show an iModel in a web browser.
 * It connects the user interface with the iModel.js services. There can be only one IModelApp active in a session.
 *
 * Applications may customize the behavior of their application by subclassing this class and supplying different
 * implementations of the members.
 *
 * Before any interactive operations may be performed, [[IModelApp.startup]] must be called (typically on a subclass of IModelApp)
 * @public
 */
export class IModelApp {
  /** @hidden */
  protected static _initialized = false;
  private static _renderSystem?: RenderSystem;
  private static _authorizationClient?: IAuthorizationClient;
  /** The [[RenderSystem]] for this session. */
  public static get renderSystem(): RenderSystem { return IModelApp._renderSystem!; }
  /** The [[ViewManager]] for this session. */
  public static viewManager: ViewManager;
  /** The [[NotificationManager]] for this session. */
  public static notifications: NotificationManager;
  /** The [[TileAdmin]] for this session. */
  public static tileAdmin: TileAdmin;
  /** The [[QuantityFormatter]] for this session. */
  public static quantityFormatter: QuantityFormatter;
  /** The [[ToolAdmin]] for this session. */
  public static toolAdmin: ToolAdmin;
  /** The [[AccuDraw]] for this session. */
  public static accuDraw: AccuDraw;
  /** The [[AccuSnap]] for this session. */
  public static accuSnap: AccuSnap;
  /** Implementation of [[IAuthorizationClient]] to supply the authorization information for this session */
  public static get authorizationClient(): IAuthorizationClient | undefined {
    return IModelApp._authorizationClient;
  }
  public static set authorizationClient(authorizationClient: IAuthorizationClient | undefined) {
    IModelApp._authorizationClient = authorizationClient;
  }
  /** @hidden */
  public static locateManager: ElementLocateManager;
  /** @hidden */
  public static tentativePoint: TentativePoint;
  /** The [[I18N]] for this session. */
  public static i18n: I18N;
  /** The [[SettingsAdmin]] for this session. */
  public static settings: SettingsAdmin;
  /** The Id of this application. Applications must set this to the Global Product Registry ID (GPRID) for usage logging. */
  public static applicationId: string;
  /** The version of this application. Must be set for usage logging. */
  public static applicationVersion: string;
  /** A uniqueId for this session */
  public static sessionId: GuidString;
  /** @hidden */
  public static readonly features = new FeatureGates();
  /** The [[ToolRegistry]] for this session. */
  public static readonly tools = new ToolRegistry();
  /** @hidden */
  protected static _imodelClient?: IModelClient;
  /** @hidden */
  public static get initialized() { return IModelApp._initialized; }

  /** The [[IModelClient]] for this session. */
  public static get iModelClient(): IModelClient {
    if (!this._imodelClient)
      this._imodelClient = new IModelHubClient();
    return this._imodelClient;
  }

  /** @hidden */
  public static set iModelClient(client: IModelClient) { this._imodelClient = client; }
  /** @hidden */
  public static get hasRenderSystem() { return this._renderSystem !== undefined && this._renderSystem.isValid; }

  /**
   * This method must be called before any iModel.js frontend services are used. Typically, an application will make a subclass of IModelApp
   * and call this method on that subclass. E.g:
   * ``` ts
   * MyApp extends IModelApp {
   *  . . .
   * }
   * ```
   * in your source somewhere before you use any iModel.js services, call:
   * ``` ts
   * MyApp.startup();
   * ```
   */
  public static startup(imodelClient?: IModelClient, renderSysOpt?: RenderSystem.Options): void {
    if (IModelApp._initialized)
      throw new IModelError(IModelStatus.AlreadyLoaded, "startup may only be called once");

    // Setup a current context for all requests that originate from this frontend
    const requestContext = new FrontendRequestContext();
    requestContext.enter();

    IModelApp._initialized = true;
    IModelApp.sessionId = Guid.createValue();
    IModelApp.applicationVersion = this.getApplicationVersion();

    if (imodelClient !== undefined)
      this._imodelClient = imodelClient;

    IModelApp._setupRpcRequestContext();

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    IModelApp.i18n = new I18N(["iModelJs"], "iModelJs", this.supplyI18NOptions());

    const tools = IModelApp.tools; // first register all the core tools. Subclasses may choose to override them.
    const coreNamespace = IModelApp.i18n.registerNamespace("CoreTools");
    tools.registerModule(selectTool, coreNamespace);
    tools.registerModule(idleTool, coreNamespace);
    tools.registerModule(viewTool, coreNamespace);
    tools.registerModule(clipViewTool, coreNamespace);
    tools.registerModule(measureTool, coreNamespace);
    tools.registerModule(pluginTool, coreNamespace);

    this.onStartup(); // allow subclasses to register their tools, set their applicationId, etc.

    // the startup function may have already allocated any of these members, so first test whether they're present
    if (!IModelApp.applicationId) IModelApp.applicationId = "2686";  // Default to product id of iModel.js
    if (!IModelApp.settings) IModelApp.settings = new ConnectSettingsClient(IModelApp.applicationId);
    if (!IModelApp._renderSystem) IModelApp._renderSystem = this.supplyRenderSystem(renderSysOpt);
    if (!IModelApp.viewManager) IModelApp.viewManager = new ViewManager();
    if (!IModelApp.tileAdmin) IModelApp.tileAdmin = TileAdmin.create();
    if (!IModelApp.notifications) IModelApp.notifications = new NotificationManager();
    if (!IModelApp.toolAdmin) IModelApp.toolAdmin = new ToolAdmin();
    if (!IModelApp.accuDraw) IModelApp.accuDraw = new AccuDraw();
    if (!IModelApp.accuSnap) IModelApp.accuSnap = new AccuSnap();
    if (!IModelApp.locateManager) IModelApp.locateManager = new ElementLocateManager();
    if (!IModelApp.tentativePoint) IModelApp.tentativePoint = new TentativePoint();
    if (!IModelApp.quantityFormatter) IModelApp.quantityFormatter = new QuantityFormatter();

    IModelApp._renderSystem.onInitialized();
    IModelApp.viewManager.onInitialized();
    IModelApp.toolAdmin.onInitialized();
    IModelApp.accuDraw.onInitialized();
    IModelApp.accuSnap.onInitialized();
    IModelApp.locateManager.onInitialized();
    IModelApp.tentativePoint.onInitialized();
  }

  /** Must be called before the application exits to release any held resources. */
  public static shutdown() {
    IModelApp.toolAdmin.onShutDown();
    IModelApp.viewManager.onShutDown();
    IModelApp.tileAdmin.onShutDown();
    IModelApp._renderSystem = dispose(IModelApp._renderSystem);
    IModelApp._initialized = false;
  }

  /** Implement this method to register your app's tools, override implementation of managers, and initialize your app-specific members.
   * @note The default tools will already be registered, so if you register tools with the same toolId, your tools will override the defaults.
   */
  protected static onStartup(): void { }

  /** Implement this method to supply options for the initialization of the [I18N]($i18n) system.
   * @hidden
   */
  protected static supplyI18NOptions(): I18NOptions | undefined { return undefined; }

  /** Implement this method to supply the RenderSystem that provides display capabilities.
   * @hidden
   */
  protected static supplyRenderSystem(options?: RenderSystem.Options): RenderSystem { return System.create(options); }

  private static getApplicationVersion(): string {
    return typeof (BUILD_SEMVER) !== "undefined" ? BUILD_SEMVER : "";
  }

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
        applicationId: IModelApp.applicationId,
        applicationVersion: IModelApp.applicationVersion,
        sessionId: IModelApp.sessionId,
        authorization,
        userId,
      };
    };
  }
}
