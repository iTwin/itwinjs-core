/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { FrontendDevTools } from "@bentley/frontend-devtools";
import { HyperModeling } from "@bentley/hypermodeling-frontend";
import {
  AccuSnap, ExternalServerExtensionLoader, IModelApp, IModelAppOptions, NativeApp, SelectionTool, SnapMode, TileAdmin, Tool,
} from "@bentley/imodeljs-frontend";
import { DrawingAidTestTool } from "./DrawingAidTestTool";
import { RecordFpsTool } from "./FpsMonitor";
import { IncidentMarkerDemoTool } from "./IncidentMarkerDemo";
import { MarkupSelectTestTool } from "./MarkupSelectTestTool";
import { OutputShadersTool } from "./OutputShadersTool";
import { ToggleShadowMapTilesTool } from "./ShadowMapDecoration";
import {
  CloneViewportTool, CloseIModelTool, CloseWindowTool, CreateWindowTool, DockWindowTool, FocusWindowTool, MaximizeWindowTool, OpenIModelTool,
  ReopenIModelTool, ResizeWindowTool, RestoreWindowTool, Surface,
} from "./Surface";
import { Notifications } from "./Notifications";
import { UiManager } from "./UiManager";
import { MarkupTool, ModelClipTool, SaveImageTool, ZoomToSelectedElementsTool } from "./Viewer";
import { ApplyModelTransformTool } from "./DisplayTransform";
import { TimePointComparisonTool } from "./TimePointComparison";
import { FenceClassifySelectedTool } from "./Fence";
import { ToggleAspectRatioSkewDecoratorTool } from "./AspectRatioSkewDecorator";
import { PathDecorationTestTool } from "./PathDecorationTest";
import { DeleteElementsTool, EditingSessionTool, MoveElementTool, PlaceLineStringTool, RedoTool, UndoTool } from "./EditingTools";
import { MobileRpcConfiguration } from "@bentley/imodeljs-common";

class DisplayTestAppAccuSnap extends AccuSnap {
  private readonly _activeSnaps: SnapMode[] = [SnapMode.NearestKeypoint];

  public get keypointDivisor() { return 2; }
  public getActiveSnapModes(): SnapMode[] { return this._activeSnaps; }
  public setActiveSnapModes(snaps: SnapMode[]): void {
    this._activeSnaps.length = snaps.length;
    for (let i = 0; i < snaps.length; i++)
      this._activeSnaps[i] = snaps[i];
  }
}

class SVTSelectionTool extends SelectionTool {
  public static toolId = "SVTSelect";
  protected initSelectTool() {
    super.initSelectTool();

    // ###TODO Want to do this only if version comparison enabled, but meh.
    IModelApp.locateManager.options.allowExternalIModels = true;
  }
}

class RefreshTilesTool extends Tool {
  public static toolId = "RefreshTiles";
  public static get maxArgs() { return undefined; }

  public run(changedModelIds?: string[]): boolean {
    if (undefined !== changedModelIds && 0 === changedModelIds.length)
      changedModelIds = undefined;

    IModelApp.viewManager.refreshForModifiedModels(changedModelIds);
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
}

class PurgeTileTreesTool extends Tool {
  public static toolId = "PurgeTileTrees";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return undefined; }

  public run(modelIds?: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined !== modelIds && 0 === modelIds.length)
      modelIds = undefined;

    vp.iModel.tiles.purgeTileTrees(modelIds).then(() => { // eslint-disable-line @typescript-eslint/no-floating-promises
      IModelApp.viewManager.refreshForModifiedModels(modelIds);
    });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args);
  }
}

class ShutDownTool extends Tool {
  public static toolId = "ShutDown";

  public run(_args: any[]): boolean {
    DisplayTestApp.surface.closeAllViewers();
    IModelApp.shutdown(); // eslint-disable-line @typescript-eslint/no-floating-promises
    debugger; // eslint-disable-line no-debugger
    return true;
  }
}

export class DisplayTestApp {
  public static tileAdminProps: TileAdmin.Props = {
    retryInterval: 50,
    enableInstancing: true,
  };

  private static _surface?: Surface;
  public static get surface() { return this._surface!; }
  public static set surface(surface: Surface) { this._surface = surface; }

  public static async startup(opts?: IModelAppOptions): Promise<void> {
    opts = opts ? opts : {};
    opts.accuSnap = new DisplayTestAppAccuSnap();
    opts.notifications = new Notifications();
    opts.tileAdmin = TileAdmin.create(DisplayTestApp.tileAdminProps);
    opts.uiAdmin = new UiManager();
    if (MobileRpcConfiguration.isMobileFrontend)
      await NativeApp.startup(opts);
    else
      await IModelApp.startup(opts);

    // For testing local extensions only, should not be used in production.
    IModelApp.extensionAdmin.addExtensionLoaderFront(new ExternalServerExtensionLoader("http://localhost:3000"));

    IModelApp.applicationLogoCard =
      () => IModelApp.makeLogoCard({ iconSrc: "DTA.png", iconWidth: 100, heading: "Display Test App", notice: "For internal testing" });

    const svtToolNamespace = IModelApp.i18n.registerNamespace("SVTTools");
    [
      ApplyModelTransformTool,
      CloneViewportTool,
      CloseIModelTool,
      CloseWindowTool,
      CreateWindowTool,
      DeleteElementsTool,
      DockWindowTool,
      DrawingAidTestTool,
      EditingSessionTool,
      FenceClassifySelectedTool,
      FocusWindowTool,
      IncidentMarkerDemoTool,
      PathDecorationTestTool,
      MarkupSelectTestTool,
      MarkupTool,
      MaximizeWindowTool,
      ModelClipTool,
      MoveElementTool,
      OpenIModelTool,
      OutputShadersTool,
      PlaceLineStringTool,
      PurgeTileTreesTool,
      RecordFpsTool,
      RedoTool,
      RefreshTilesTool,
      ReopenIModelTool,
      ResizeWindowTool,
      RestoreWindowTool,
      SaveImageTool,
      ShutDownTool,
      SVTSelectionTool,
      ToggleAspectRatioSkewDecoratorTool,
      TimePointComparisonTool,
      ToggleShadowMapTilesTool,
      UndoTool,
      ZoomToSelectedElementsTool,
    ].forEach((tool) => tool.register(svtToolNamespace));

    IModelApp.toolAdmin.defaultToolId = SVTSelectionTool.toolId;
    await FrontendDevTools.initialize();
    await HyperModeling.initialize();
  }

  public static setActiveSnapModes(snaps: SnapMode[]): void {
    (IModelApp.accuSnap as DisplayTestAppAccuSnap).setActiveSnapModes(snaps);
  }

  public static setActiveSnapMode(snap: SnapMode): void { this.setActiveSnapModes([snap]); }
}
