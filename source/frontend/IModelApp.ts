/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { DeploymentEnv, IModelHubClient } from "@bentley/imodeljs-clients";
import { ViewManager } from "./ViewManager";
import { ToolAdmin } from "./tools/ToolAdmin";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import { ElementLocateManager } from "./ElementLocateManager";
import { TentativePoint } from "./TentativePoint";
import { I18N, I18NOptions } from "./Localization";
import { ToolRegistry } from "./tools/Tool";
import { IModelError, IModelStatus, FeatureGates } from "@bentley/imodeljs-common";
import { NotificationManager } from "./NotificationManager";

import * as selectTool from "./tools/SelectTool";
import * as viewTool from "./tools/ViewTool";
import * as idleTool from "./tools/IdleTool";

/**
 * An instance of IModelApp is the administrator for applications that read, write, or display an iModel in a browser.
 * It connects the user interface with the iModelJs services. There can be only one IModelApp active in a session.
 *
 * Applications may customize the behavior of the IModelApp services by subclassing this class and supplying different
 * implementations of them.
 *
 * Before any interactive operations may be performed, IModelApp.startup must be called (typically on a subclass of IModelApp)
 */
export class IModelApp {
  protected static _initialized = false;
  public static viewManager: ViewManager;
  public static notifications: NotificationManager;
  public static toolAdmin: ToolAdmin;
  public static accuDraw: AccuDraw;
  public static accuSnap: AccuSnap;
  public static locateManager: ElementLocateManager;
  public static tentativePoint: TentativePoint;
  public static i18n: I18N;
  public static deploymentEnv: DeploymentEnv = "QA";
  public static readonly features = new FeatureGates();
  public static readonly tools = new ToolRegistry();
  protected static _iModelHubClient?: IModelHubClient;
  public static get iModelHubClient(): IModelHubClient { return this._iModelHubClient ? this._iModelHubClient : (this._iModelHubClient = new IModelHubClient(this.deploymentEnv)); }

  /**
   * This method must be called before any iModelJs services are used. Typically, an application will make a subclass of IModelApp
   * and call this method on that subclass. E.g:
   * ``` ts
   * MyApp extends IModelApp {
   *  . . .
   * }
   * ```
   * in your source somewhere before you use any iModelJs services, call:
   * ``` ts
   * MyApp.startup();
   * ```
   */
  public static startup(deploymentEnv: DeploymentEnv = "QA") {
    if (IModelApp._initialized)
      throw new IModelError(IModelStatus.AlreadyLoaded, "startup may only be called once");

    IModelApp._initialized = true;
    IModelApp.deploymentEnv = deploymentEnv;

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    IModelApp.i18n = new I18N(["iModelJs"], "iModelJs", this.supplyI18NOptions());

    const tools = IModelApp.tools; // first register all the core tools. Subclasses may choose to override them.
    const coreNamespace = IModelApp.i18n.registerNamespace("CoreTools");
    tools.registerModule(selectTool, coreNamespace);
    tools.registerModule(idleTool, coreNamespace);
    tools.registerModule(viewTool, coreNamespace);

    this.onStartup(); // allow subclasses to register their tools, etc.

    // the startup function may have already allocated any of these members, so first test whether they're present
    if (!IModelApp.viewManager) IModelApp.viewManager = new ViewManager();
    if (!IModelApp.notifications) IModelApp.notifications = new NotificationManager();
    if (!IModelApp.toolAdmin) IModelApp.toolAdmin = new ToolAdmin();
    if (!IModelApp.accuDraw) IModelApp.accuDraw = new AccuDraw();
    if (!IModelApp.accuSnap) IModelApp.accuSnap = new AccuSnap();
    if (!IModelApp.locateManager) IModelApp.locateManager = new ElementLocateManager();
    if (!IModelApp.tentativePoint) IModelApp.tentativePoint = new TentativePoint();

    IModelApp.viewManager.onInitialized();
    IModelApp.toolAdmin.onInitialized();
    IModelApp.accuDraw.onInitialized();
    IModelApp.accuSnap.onInitialized();
    IModelApp.locateManager.onInitialized();
    IModelApp.tentativePoint.onInitialized();
  }

  public static shutdown() { IModelApp._initialized = false; }

  /**
   * Implement this method to register your app's tools, override implementation of managers, and initialize your app-specific members.
   * @note The default tools will already be registered, so if you register tools with the same toolId, your tools will override the defaults.
   */
  protected static onStartup(): void { }

  /**
   * Implement this method to supply options for the initialization of the internationalization.
   */
  protected static supplyI18NOptions(): I18NOptions | undefined { return undefined; }
}
