/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewManager } from "./ViewManager";
import { ToolAdmin } from "./tools/ToolAdmin";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import { ElementLocateManager } from "./ElementLocateManager";
import { TentativePoint } from "./TentativePoint";
import { ToolRegistry } from "./tools/Tool";
import { I18N, I18NNamespace, I18NOptions } from "./Localization";
import { FeatureGates } from "../common/FeatureGates";

import * as selectTool from "./tools/SelectTool";
import * as viewTool from "./tools/ViewTool";
import * as idleTool from "./tools/IdleTool";

/** Global access to the IModelApp. Initialized by calling IModelApp.startup(). */
export let iModelApp: IModelApp;

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
  protected _viewManager?: ViewManager;
  protected _toolAdmin?: ToolAdmin;
  protected _accuDraw?: AccuDraw;
  protected _accuSnap?: AccuSnap;
  protected _locateManager?: ElementLocateManager;
  protected _tentativePoint?: TentativePoint;
  protected _i18N?: I18N;
  public readonly features = new FeatureGates();
  public readonly tools = new ToolRegistry();

  public get viewManager(): ViewManager { return this._viewManager!; }
  public get toolAdmin(): ToolAdmin { return this._toolAdmin!; }
  public get accuDraw(): AccuDraw { return this._accuDraw!; }
  public get accuSnap(): AccuSnap { return this._accuSnap!; }
  public get locateManager(): ElementLocateManager { return this._locateManager!; }
  public get tentativePoint(): TentativePoint { return this._tentativePoint!; }
  public get i18N(): I18N { return this._i18N!; }

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
  public static startup() {
    iModelApp = new this(); // this will create an instance of the appropriate subclass of IModelApp (that calls this static method)

    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    iModelApp._i18N = new I18N(["iModelSystem"], "iModelSystem", iModelApp.supplyI18NOptions());

    const tools = iModelApp.tools; // first register all the default tools. Subclasses may choose to override them.
    const namespace: I18NNamespace = iModelApp.i18N.registerNamespace("BaseTools");
    tools.registerModule(selectTool, namespace);
    tools.registerModule(idleTool, namespace);
    tools.registerModule(viewTool, namespace);

    iModelApp.onStartup(); // allow subclasses to register their tools before we call onStartup

    if (!iModelApp._viewManager) iModelApp._viewManager = new ViewManager();
    if (!iModelApp._toolAdmin) iModelApp._toolAdmin = new ToolAdmin();
    if (!iModelApp._accuDraw) iModelApp._accuDraw = new AccuDraw();
    if (!iModelApp._accuSnap) iModelApp._accuSnap = new AccuSnap();
    if (!iModelApp._locateManager) iModelApp._locateManager = new ElementLocateManager();
    if (!iModelApp._tentativePoint) iModelApp._tentativePoint = new TentativePoint();

    iModelApp._viewManager.onInitialized();
    iModelApp._toolAdmin.onInitialized();
    iModelApp._accuDraw.onInitialized();
    iModelApp._accuSnap.onInitialized();
    iModelApp._locateManager.onInitialized();
    iModelApp._tentativePoint.onInitialized();
  }

  /**
   * Implement this method to register your app's tools, override implementation of managers, and initialize your app-specific members.
   * @note The default tools will already be registered, so if you register tools with the same toolId, your tools will override the defaults.
   */
  protected onStartup(): void { }

  /**
   * Implement this method to supply options for the initialization of the internationalization.
   */
  protected supplyI18NOptions(): I18NOptions | undefined {
    // get the localization system set up so registering tools works. At startup, the only namespace is the system namespace.
    return undefined;
  }
}
