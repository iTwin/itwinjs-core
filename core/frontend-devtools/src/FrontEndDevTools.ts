/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import {
  ToggleLogZTool,
  TogglePrimitiveVisibilityTool,
  ToggleReadPixelsTool,
  SetVolClassIntersectOn,
  SetVolClassIntersectOff,
  ToggleDrapeFrustumTool,
  ToggleRealityTileBounds,
  ToggleRealityTilePreload,
  ToggleRealityTileLogging,
  ToggleRealityTileFreeze,
} from "./tools/RenderTargetTools";
import {
  CompileShadersTool,
  LoseWebGLContextTool,
  ToggleWiremeshTool,
} from "./tools/RenderSystemTools";
import {
  ClearIsolatedElementsTool,
  EmphasizeSelectedElementsTool,
  IsolateSelectedElementsTool,
} from "./tools/EmphasizeElementsTool";
import { InspectElementTool } from "./tools/InspectElementTool";
import {
  ChangeViewFlagsTool,
  ToggleSkyboxTool,
} from "./tools/DisplayStyleTools";
import {
  SaveViewTool,
  ApplyViewTool,
} from "./tools/SavedViews";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents";
import {
  ToggleFrustumSnapshotTool,
  ToggleSelectedViewFrustumTool,
  ToggleShadowFrustumTool,
} from "./tools/FrustumDecoration";
import {
  ChangeEmphasisSettingsTool,
  ChangeHiliteSettingsTool,
  DefaultTileSizeModifierTool,
  FadeOutTool,
  FreezeSceneTool,
  SetAspectRatioSkewTool,
  ShowTileVolumesTool,
  ViewportTileSizeModifierTool,
  ViewportAddRealityModel,
} from "./tools/ViewportTools";
import { RealityTransitionTool } from "./tools/RealityTransitionTool";
import { ToggleToolTipsTool } from "./tools/ToolTipProvider";
import { ChangeUnitsTool } from "./tools/ChangeUnitsTool";
import { ToggleTileRequestDecorationTool } from "./tools/TileRequestDecoration";
import { MeasureTileLoadTimeTool } from "./tools/MeasureTileLoadTime";
import { SelectElementsByIdTool } from "./tools/SelectionTools";
import { AnimationIntervalTool } from "./tools/AnimationIntervalTool";
import {
  ChangePlanProjectionSettingsTool,
  DumpPlanProjectionSettingsTool,
  OverrideSubCategoryPriorityTool,
} from "./tools/PlanProjectionTools";
import { ToggleTileTreeBoundsDecorationTool } from "./tools/TileTreeBoundsDecoration";

/** Entry-point for the package. Before using the package you *must* call [[FrontendDevTools.initialize]].
 * @beta
 */
export class FrontendDevTools {
  private static _initialized = false;

  /** Call this before using the package (e.g., before instantiating any of its widgets or attempting to use any of its tools.
   * To initialize when starting up your app:
   * ```ts
   *   IModelApp.startup();
   *   await FrontendDevTools.initialize();
   * ```
   * @beta
   */
  public static async initialize(): Promise<void> {
    if (this._initialized)
      return Promise.resolve();

    this._initialized = true;

    const i18n = IModelApp.i18n.registerNamespace("FrontendDevTools");
    const tools = [
      AnimationIntervalTool,
      ApplyViewTool,
      ChangeEmphasisSettingsTool,
      ChangeHiliteSettingsTool,
      ChangePlanProjectionSettingsTool,
      ChangeUnitsTool,
      ChangeViewFlagsTool,
      ClearIsolatedElementsTool,
      CompileShadersTool,
      DefaultTileSizeModifierTool,
      DumpPlanProjectionSettingsTool,
      EmphasizeSelectedElementsTool,
      FadeOutTool,
      FreezeSceneTool,
      InspectElementTool,
      IsolateSelectedElementsTool,
      LoseWebGLContextTool,
      MeasureTileLoadTimeTool,
      OverrideSubCategoryPriorityTool,
      RealityTransitionTool,
      ReportWebGLCompatibilityTool,
      SaveViewTool,
      SelectElementsByIdTool,
      SetAspectRatioSkewTool,
      SetVolClassIntersectOff,
      SetVolClassIntersectOn,
      ShowTileVolumesTool,
      ToggleDrapeFrustumTool,
      ToggleFrustumSnapshotTool,
      ToggleLogZTool,
      TogglePrimitiveVisibilityTool,
      ToggleProjectExtentsTool,
      ToggleReadPixelsTool,
      ToggleSelectedViewFrustumTool,
      ToggleShadowFrustumTool,
      ToggleSkyboxTool,
      ToggleTileRequestDecorationTool,
      ToggleTileTreeBoundsDecorationTool,
      ToggleToolTipsTool,
      ToggleWiremeshTool,
      ToggleRealityTileBounds,
      ToggleRealityTilePreload,
      ToggleRealityTileLogging,
      ToggleRealityTileFreeze,
      ViewportAddRealityModel,
      ViewportTileSizeModifierTool,
    ];

    for (const tool of tools)
      tool.register(i18n);

    return i18n.readFinished;
  }
}
