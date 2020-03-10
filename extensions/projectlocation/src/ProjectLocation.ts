/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Extension, PrimitiveTool, CoordinateLockOverrides, BeButtonEvent, HitDetail, EventHandled, LocateResponse, ManipulatorToolEvent, BeTouchEvent, LocateFilterStatus, Tool } from "@bentley/imodeljs-frontend";
import { I18NNamespace } from "@bentley/imodeljs-i18n";
import { ProjectExtentsClipDecoration } from "./ProjectExtentsDecoration";
import { ProjectGeolocationPointTool, ProjectGeolocationNorthTool } from "./ProjectGeolocation";

/** Parses a string case-insensitively returning true for "ON", false for "OFF", undefined for "TOGGLE" or undefined, and the input string for anything else. */
function parseToggle(arg: string | undefined): string | boolean | undefined {
  if (undefined === arg)
    return undefined;

  switch (arg.toLowerCase()) {
    case "on": return true;
    case "off": return false;
    case "toggle": return undefined;
    default: return arg;
  }
}

/** Create change request to update project extents and/or geolocation.
 * @beta
 */
export class ProjectLocationUpdateTool extends Tool {
  public static toolId = "ProjectLocation.Update";

  public run(): boolean {
    const deco = ProjectExtentsClipDecoration.get();
    if (undefined === deco)
      return false;
    const extents = deco.getModifiedExtents();
    const ecefLocation = deco.getModifiedEcefLocation();
    if (undefined === extents && undefined === ecefLocation)
      return false;
    // ### TODO: Make change set for EcefLocationProps/Range3dProps...
    return true;
  }
}

/** Enable project location decoration.
 * @beta
 */
export class ProjectLocationShowTool extends Tool {
  public static toolId = "ProjectLocation.Show";

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !ProjectExtentsClipDecoration.show(vp))
      return false;
    IModelApp.toolAdmin.startDefaultTool();
    return true;
  }
}

/** Disable project location decoration leaving modified ecef location and project extents view clip.
 * @beta
 */
export class ProjectLocationHideTool extends Tool {
  public static toolId = "ProjectLocation.Hide";

  public run(): boolean {
    ProjectExtentsClipDecoration.hide();
    IModelApp.toolAdmin.startDefaultTool();
    return true;
  }
}

/** Disable project location decoration after clearing modified ecef location and project extents view clip.
 * @beta
 */
export class ProjectLocationClearTool extends Tool {
  public static toolId = "ProjectLocation.Clear";

  public run(): boolean {
    ProjectExtentsClipDecoration.clear();
    IModelApp.toolAdmin.startDefaultTool();
    return true;
  }
}

/** Simple default tool implementation that only supports pickable decorations (like the project extents decoration).
 * @beta
 */
export class ProjectLocationSelectTool extends PrimitiveTool {
  public static hidden = false;
  public static toolId = "ProjectLocation.Select";
  public static iconSpec = "icon-cursor";

  public requireWriteableTarget(): boolean { return false; }
  public autoLockTarget(): void { } // NOTE: For picking decorations we only care about iModel, so don't lock target model automatically.

  protected provideToolAssistance(): void { } // ### TODO: Tool assistance...

  protected initTool(): void {
    this.initLocateElements(true, false, "default", CoordinateLockOverrides.All);
    IModelApp.locateManager.options.allowDecorations = true;
    this.provideToolAssistance();
  }

  public async selectDecoration(ev: BeButtonEvent, currHit?: HitDetail): Promise<EventHandled> {
    if (undefined === currHit)
      currHit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);

    if (undefined !== currHit && !currHit.isElementHit)
      return IModelApp.viewManager.onDecorationButtonEvent(currHit, ev);

    return EventHandled.No;
  }

  public async onMouseStartDrag(ev: BeButtonEvent): Promise<EventHandled> {
    IModelApp.accuSnap.clear(); // Need to test hit at start drag location, not current AccuSnap...
    return this.selectDecoration(ev);
  }

  public async onDataButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    if (undefined === ev.viewport)
      return EventHandled.No;

    const hit = await IModelApp.locateManager.doLocate(new LocateResponse(), true, ev.point, ev.viewport, ev.inputSource);
    if (hit !== undefined && !hit.isModelHit) { // model hit = terrain, reality models, background maps, etc - not selectable
      if (EventHandled.Yes === await this.selectDecoration(ev, hit))
        return EventHandled.Yes;

      if (ev.isControlKey)
        this.iModel.selectionSet.invert(hit.sourceId);
      else
        this.iModel.selectionSet.replace(hit.sourceId);

      return EventHandled.Yes;
    }

    return EventHandled.Yes;
  }

  public async onResetButtonUp(ev: BeButtonEvent): Promise<EventHandled> {
    return this.selectDecoration(ev, IModelApp.accuSnap.currHit);
  }

  public onSuspend(): void { IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Suspend); }
  public onUnsuspend(): void { IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Unsuspend); this.provideToolAssistance(); }

  public async onTouchMoveStart(ev: BeTouchEvent, startEv: BeTouchEvent): Promise<EventHandled> {
    if (!startEv.isSingleTouch)
      return EventHandled.No;
    await IModelApp.toolAdmin.convertTouchMoveStartToButtonDownAndMotion(startEv, ev);
    return IModelApp.toolAdmin.activeTool !== this ? EventHandled.Yes : EventHandled.No; // If suspended by modify handle input collector, don't pass event on to IdleTool...
  }

  public async filterHit(hit: HitDetail, _out?: LocateResponse): Promise<LocateFilterStatus> {
    return hit.isElementHit ? LocateFilterStatus.Reject : LocateFilterStatus.Accept;
  }

  public onRestartTool(): void { this.exitTool(); }

  public onCleanup(): void {
    IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Stop);
  }

  public onPostInstall(): void {
    super.onPostInstall();
    if (!this.targetView)
      return;
    IModelApp.toolAdmin.manipulatorToolEvent.raiseEvent(this, ManipulatorToolEvent.Start);
    this.initTool();
  }

  public static startTool(): boolean { return new ProjectLocationSelectTool().run(); }
}

/** The extension class that is instantiated when the extension is loaded, and executes the operations
 * @beta
 */
export class ProjectLocationExtension extends Extension {
  private _i18NNamespace?: I18NNamespace;
  public static extension: ProjectLocationExtension | undefined;
  private static _saveDefaultToolId = "";
  private static _changeDefaultTool = false;

  /** Invoked the first time this extension is loaded. */
  public onLoad(_args: string[]): void {
    ProjectLocationExtension.extension = this; // store the extension.
    this._i18NNamespace = this.i18n.registerNamespace("ProjectLocation");
    this._i18NNamespace!.readFinished.then(() => {
      IModelApp.tools.register(ProjectLocationSelectTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectLocationShowTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectLocationHideTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectLocationClearTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectLocationUpdateTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectGeolocationPointTool, this._i18NNamespace, this.i18n);
      IModelApp.tools.register(ProjectGeolocationNorthTool, this._i18NNamespace, this.i18n);
    }).catch(() => { });
  }

  /** Invoked each time this extension is loaded. */
  public onExecute(args: string[]): void {
    if (args.length < 2)
      return; // if no "optional" args passed in, don't do anything. NOTE: args[0] is extension name...

    const enable = parseToggle(args[1]);
    if (typeof enable !== "boolean")
      return; // Allow simple enable/disable request only...

    // NOTE: For easier testing. If this extension starts including a frontstage, that should specify the default tool to use instead of being done here...
    this.establishDefaultTool(enable);

    if (enable)
      new ProjectLocationShowTool().run();
    else
      new ProjectLocationClearTool().run();

    if (enable && undefined === IModelApp.toolAdmin.activeTool)
      ProjectLocationSelectTool.startTool(); // NOTE: onExecute gets called immediately after onLoad, so startDefaultTool will fail to find our new tool initially...
  }

  private establishDefaultTool(enable: boolean): void {
    if (!ProjectLocationExtension._changeDefaultTool)
      return;

    if (enable) {
      if ("ProjectLocation.Select" === IModelApp.toolAdmin.defaultToolId)
        return;

      // Make the project extents decoration select tool the default tool, save current default tool...
      ProjectLocationExtension._saveDefaultToolId = IModelApp.toolAdmin.defaultToolId;
      IModelApp.toolAdmin.defaultToolId = "ProjectLocation.Select";
    } else {
      if ("ProjectLocation.Select" !== IModelApp.toolAdmin.defaultToolId)
        return;

      // Restore the original default tool...
      IModelApp.toolAdmin.defaultToolId = ProjectLocationExtension._saveDefaultToolId;
      ProjectLocationExtension._saveDefaultToolId = "";
    }
  }
}

// This variable is set by webPack when building a extension.
declare var PLUGIN_NAME: string;

// Register the extension with the extensionAdmin.
IModelApp.extensionAdmin.register(new ProjectLocationExtension(PLUGIN_NAME));
