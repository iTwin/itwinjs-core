/*---------------------------------------------------------------------------------------------
* Copyright (c) 2018 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
/** @module IModelApp */

import { dispose, RepositoryStatus } from "@bentley/bentleyjs-core";
import { ConnectSettingsClient, DeploymentEnv, IModelClient, IModelHubClient, SettingsAdmin } from "@bentley/imodeljs-clients";
import { FeatureGates, IModelError, IModelStatus } from "@bentley/imodeljs-common";
import { I18N, I18NOptions } from "@bentley/imodeljs-i18n";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import { ElementLocateManager } from "./ElementLocateManager";
import { NotificationManager } from "./NotificationManager";
import { QuantityFormatter } from "./QuantityFormatter";
import { RenderSystem } from "./render/System";
import { System } from "./render/webgl/System";
import { TentativePoint } from "./TentativePoint";
import { ToolRegistry } from "./tools/Tool";
import { ToolAdmin } from "./tools/ToolAdmin";
import { ViewManager } from "./ViewManager";

import * as idleTool from "./tools/IdleTool";
import * as selectTool from "./tools/SelectTool";
import * as viewTool from "./tools/ViewTool";

/**
 * An instance of IModelApp is the frontend administrator for applications that read, write, or display an iModel in a browser.
 * It connects the user interface with the iModel.js services. There can be only one IModelApp active in a session.
 *
 * Applications may customize the behavior of the IModelApp services by subclassing this class and supplying different
 * implementations of them.
 *
 * Before any interactive operations may be performed, [[IModelApp.startup]] must be called (typically on a subclass of IModelApp)
 */
export class IModelApp {
  protected static _initialized = false;
  private static _renderSystem?: RenderSystem;
  public static get renderSystem(): RenderSystem { return IModelApp._renderSystem!; }
  public static viewManager: ViewManager;
  public static notifications: NotificationManager;
  public static quantityFormatter: QuantityFormatter;
  public static toolAdmin: ToolAdmin;
  public static accuDraw: AccuDraw;
  public static accuSnap: AccuSnap;
  public static locateManager: ElementLocateManager;
  public static tentativePoint: TentativePoint;
  /** Instance of an I18N used to access the iModelJs localization services. */
  public static i18n: I18N;
  /** Instance of an object implementing the SettingsAdmin interface, used to access the iModelJs Settings services. */
  public static settingsAdmin: SettingsAdmin;
  public static applicationId: string;

  /** The deployment environment of Connect and iModelHub Services - this identifies up the location used to find Projects and iModels. */
  public static hubDeploymentEnv: DeploymentEnv = "QA";

  public static readonly features = new FeatureGates();
  public static readonly tools = new ToolRegistry();
  protected static _imodelClient?: IModelClient;
  public static get initialized() { return IModelApp._initialized; }

  /** IModelClient to be used for all frontend operations */
  public static get iModelClient(): IModelClient {
    if (!this._imodelClient)
      this._imodelClient = new IModelHubClient(this.hubDeploymentEnv);
    else if (this._imodelClient.deploymentEnv !== this.hubDeploymentEnv)
      throw new IModelError(RepositoryStatus.ServerUnavailable);
    return this._imodelClient;
  }

  public static set iModelClient(client: IModelClient) { this._imodelClient = client; }
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
  public static startup(imodelClient?: IModelClient) {
    if (IModelApp._initialized)
      throw new IModelError(IModelStatus.AlreadyLoaded, "startup may only be called once");

    IModelApp._initialized = true;

    if (imodelClient !== undefined)
      this._imodelClient = imodelClient;

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    IModelApp.i18n = new I18N(["iModelJs"], "iModelJs", this.supplyI18NOptions());

    const tools = IModelApp.tools; // first register all the core tools. Subclasses may choose to override them.
    const coreNamespace = IModelApp.i18n.registerNamespace("CoreTools");
    tools.registerModule(selectTool, coreNamespace);
    tools.registerModule(idleTool, coreNamespace);
    tools.registerModule(viewTool, coreNamespace);

    this.onStartup(); // allow subclasses to register their tools, set their applicationId, etc.

    // the startup function may have already allocated any of these members, so first test whether they're present
    if (!IModelApp.applicationId) IModelApp.applicationId = "IModelJsApp";
    if (!IModelApp.settingsAdmin) IModelApp.settingsAdmin = new ConnectSettingsClient(IModelApp.hubDeploymentEnv, IModelApp.applicationId);
    if (!IModelApp._renderSystem) IModelApp._renderSystem = this.supplyRenderSystem();
    if (!IModelApp.viewManager) IModelApp.viewManager = new ViewManager();
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

  /** Should be called before the application exits to release any held resources. */
  public static shutdown() {
    IModelApp.toolAdmin.onShutDown();
    IModelApp.viewManager.onShutDown();
    IModelApp._renderSystem = dispose(IModelApp._renderSystem);
    IModelApp._initialized = false;
  }

  /**
   * Implement this method to register your app's tools, override implementation of managers, and initialize your app-specific members.
   * @note The default tools will already be registered, so if you register tools with the same toolId, your tools will override the defaults.
   */
  protected static onStartup(): void { }

  /**
   * Implement this method to supply options for the initialization of the [I18N]($i18n) system.
   */
  protected static supplyI18NOptions(): I18NOptions | undefined { return undefined; }

  /**
   * Implement this method to supply the RenderSystem that provides display capabilities.
   */
  protected static supplyRenderSystem(): RenderSystem { return System.create(); }
}
