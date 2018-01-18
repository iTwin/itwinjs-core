/*---------------------------------------------------------------------------------------------
|  $Copyright: (c) 2018 Bentley Systems, Incorporated. All rights reserved. $
 *--------------------------------------------------------------------------------------------*/
import { ViewManager } from "./ViewManager";
import { ToolAdmin } from "./tools/ToolAdmin";
import { AccuDraw } from "./AccuDraw";
import { AccuSnap } from "./AccuSnap";
import { ElementLocateManager } from "./ElementLocateManager";
import { TentativePoint } from "./TentativePoint";
import { ToolCtor, Tool, ToolGroup } from "./tools/Tool";
import { I18N } from "./Localization";

/** holds a mapping of toolId string to tool class */
export class ToolRegistry {
  public map: Map<string, ToolCtor> = new Map<string, ToolCtor>();
  public unRegisterTool(toolId: string) { this.map.delete(toolId); }

  /** register a tool  */
  public registerTool(ctor: ToolCtor, group: ToolGroup) {
    if (ctor.toolId.length !== 0) {
      ctor.group = group;
      this.map.set(ctor.toolId, ctor);
    }
  }

  /**
   * register all the tools found in a module.
   * @param modelObj the module to search for subclasses of Tool.
   */
  public registerModuleTools(moduleObj: any, scope: ToolGroup) {
    for (const thisMember in moduleObj) {
      if (!thisMember)
        continue;

      const thisTool = moduleObj[thisMember];
      if (thisTool.prototype instanceof Tool) {
        this.registerTool(thisTool, scope);
      }
    }
  }
}

/** global access to the active IModelApp. Initialized by calling IModelApp.startup(). */
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
   * MyIModelApp extends IModelApp {
   *  . . .
   * }
   * ```
   * in your source somewhere before you use any iModelJs services, call:
   * ``` ts
   * MyIModelApp.startup();
   * ```
   */
  public static startup() {
    iModelApp = new this(); // this will create an instance of the appropriate subclass of IModelApp (that calls this static method)

    const tools = iModelApp.tools; // first register all the default tools. Subclasses may choose to override them.
    const group = new ToolGroup("BaseTool");
    tools.registerModuleTools(require("./tools/ViewTool"), group);
    tools.registerModuleTools(require("./tools/IdleTool"), group);

    iModelApp.onStartup(); // allow subclasses to register their tools before we call onStartup

    if (!iModelApp._viewManager) iModelApp._viewManager = new ViewManager();
    if (!iModelApp._toolAdmin) iModelApp._toolAdmin = new ToolAdmin();
    if (!iModelApp._accuDraw) iModelApp._accuDraw = new AccuDraw();
    if (!iModelApp._accuSnap) iModelApp._accuSnap = new AccuSnap();
    if (!iModelApp._locateManager) iModelApp._locateManager = new ElementLocateManager();
    if (!iModelApp._tentativePoint) iModelApp._tentativePoint = new TentativePoint();
    if (!iModelApp._i18N) iModelApp._i18N = new I18N(["tools"], "tools", null);

    iModelApp._viewManager.onInitialized();
    iModelApp._toolAdmin.onInitialized();
    iModelApp._accuDraw.onInitialized();
    iModelApp._accuSnap.onInitialized();
    iModelApp._locateManager.onInitialized();
    iModelApp._tentativePoint.onInitialized();
  }

  protected onStartup(): void { }

  /**
   * Look up a tool by toolId. If found, create a new instance of that tool with the supplied arguments
   */
  public createTool(toolId: string, ...args: any[]): Tool | undefined {
    const ctor = this.tools.map.get(toolId);
    return ctor ? new ctor(...args) : undefined;
  }
  public createLocalizer(nameSpaces: string[], defaultNameSpace: string, renderFunction: any): I18N {
    // create a separate instance of i18next, so it doesn't interfere with other i18next instances.
    return new I18N(nameSpaces, defaultNameSpace, renderFunction);
  }
}
