/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewManager } from "./ViewManager";
import { ToolAdmin } from "./tools/ToolAdmin";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import { ElementLocateManager } from "./ElementLocateManager";
import { TentativePoint } from "./TentativePoint";
import { ToolCtor, Tool } from "./tools/Tool";

declare var require: any;

/** global access to the active IModelApp. Initialized by calling IModelApp.startup(). */
export let iModelApp: IModelApp;

/** holds a mapping of toolId string to tool class */
export class ToolRegistry {
  public map: Map<string, ToolCtor> = new Map<string, ToolCtor>();

  /** register a tool  */
  public registerTool(ctor: ToolCtor) {
    if (ctor.toolId.length !== 0)
      this.map.set(ctor.toolId, ctor);
  }

  /** register all the tools found in a module */
  public registerModuleTools(moduleObj: any) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisTool = moduleObj[thisMember];
      if (thisTool.prototype instanceof Tool) {
        this.registerTool(thisTool);
      }
    }
  }
}

/**
 * An instance of IModelApp is the administrator object for applications that read, write, or display an iModel in a browser.
 * It connects the user interface with the iModelJs services. There can be only one IModelApp active in a session.
 *
 * Applications may customize the behavior of the IModelApp services by subclassing this class and supplying different
 * implementations of them.
 *
 * Before any interactive operations may be performed, IModelApp.startup must be called.
 */
export class IModelApp {
  protected _viewManager?: ViewManager;
  protected _toolAdmin?: ToolAdmin;
  protected _accuDraw?: AccuDraw;
  protected _accuSnap?: AccuSnap;
  protected _locateManager?: ElementLocateManager;
  protected _tentativePoint?: TentativePoint;
  public tools = new ToolRegistry();

  public get viewManager(): ViewManager { return this._viewManager!; }
  public get toolAdmin(): ToolAdmin { return this._toolAdmin!; }
  public get accuDraw(): AccuDraw { return this._accuDraw!; }
  public get accuSnap(): AccuSnap { return this._accuSnap!; }
  public get locateManager(): ElementLocateManager { return this._locateManager!; }
  public get tentativePoint(): TentativePoint { return this._tentativePoint!; }

  /**
   * This method must be called before any iModelJs services are used.
   */
  public static startup(app?: IModelApp) {
    iModelApp = app ? app : new IModelApp();
    iModelApp.onStartup();
  }

  protected onStartup(): void {
    if (!this._viewManager) this._viewManager = new ViewManager();
    if (!this._toolAdmin) this._toolAdmin = new ToolAdmin();
    if (!this._accuDraw) this._accuDraw = new AccuDraw();
    if (!this._accuSnap) this._accuSnap = new AccuSnap();
    if (!this._locateManager) this._locateManager = new ElementLocateManager();
    if (!this._tentativePoint) this._tentativePoint = new TentativePoint();

    this._viewManager.onInitialized();
    this._toolAdmin.onInitialized();
    this._accuDraw.onInitialized();
    this._accuSnap.onInitialized();
    this._locateManager.onInitialized();
    this._tentativePoint.onInitialized();

    this.tools.map.clear();
    this.tools.registerModuleTools(require("./tools/ViewTool"));
  }

  /** look up a tool by toolId. If found create a new instance of that tool with the supplied arguments */
  public createTool(toolId: string, ...args: any[]): Tool | undefined {
    const ctor = this.tools.map.get(toolId);
    return ctor ? new ctor(...args) : undefined;
  }
}
