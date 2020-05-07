/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { IModelApp } from "@bentley/imodeljs-frontend";
import { AnimationIntervalTool } from "./tools/AnimationIntervalTool";
import { ChangeUnitsTool } from "./tools/ChangeUnitsTool";
import { ClipColorTool } from "./tools/ClipColorTool";
import { ChangeViewFlagsTool, ToggleSkyboxTool } from "./tools/DisplayStyleTools";
import { ClearIsolatedElementsTool, EmphasizeSelectedElementsTool, IsolateSelectedElementsTool } from "./tools/EmphasizeElementsTool";
import { ToggleFrustumSnapshotTool, ToggleSelectedViewFrustumTool, ToggleShadowFrustumTool } from "./tools/FrustumDecoration";
import { InspectElementTool } from "./tools/InspectElementTool";
import { MeasureTileLoadTimeTool } from "./tools/MeasureTileLoadTime";
import { ChangePlanProjectionSettingsTool, DumpPlanProjectionSettingsTool, OverrideSubCategoryPriorityTool } from "./tools/PlanProjectionTools";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents";
import { AttachRealityModelTool, SaveRealityModelTool } from "./tools/RealityModelTools";
import { RealityTransitionTool } from "./tools/RealityTransitionTool";
import { CompileShadersTool, LoseWebGLContextTool, ToggleWiremeshTool } from "./tools/RenderSystemTools";
import {
  SetVolClassIntersectOff, SetVolClassIntersectOn, ToggleDrapeFrustumTool, TogglePrimitiveVisibilityTool, ToggleReadPixelsTool,
  ToggleRealityTileBounds, ToggleRealityTileFreeze, ToggleRealityTileLogging, ToggleRealityTilePreload,
} from "./tools/RenderTargetTools";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import { ApplyViewTool, SaveViewTool } from "./tools/SavedViews";
import { SelectElementsByIdTool } from "./tools/SelectionTools";
import { ElementIdFromSourceAspectIdTool, SourceAspectIdFromElementIdTool } from "./tools/SourceAspectIdTools";
import { ToggleTileRequestDecorationTool } from "./tools/TileRequestDecoration";
import { ToggleTileTreeBoundsDecorationTool } from "./tools/TileTreeBoundsDecoration";
import { ToggleToolTipsTool } from "./tools/ToolTipProvider";
import {
  ChangeEmphasisSettingsTool, ChangeHiliteSettingsTool, DefaultTileSizeModifierTool, FadeOutTool, FreezeSceneTool, SetAspectRatioSkewTool,
  ShowTileVolumesTool, Toggle3dManipulationsTool, ViewportAddRealityModel, ViewportTileSizeModifierTool,
} from "./tools/ViewportTools";

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
      ClipColorTool,
      CompileShadersTool,
      DefaultTileSizeModifierTool,
      DumpPlanProjectionSettingsTool,
      ElementIdFromSourceAspectIdTool,
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
      SourceAspectIdFromElementIdTool,
      Toggle3dManipulationsTool,
      ToggleDrapeFrustumTool,
      ToggleFrustumSnapshotTool,
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
      AttachRealityModelTool,
      SaveRealityModelTool,
    ];

    for (const tool of tools)
      tool.register(i18n);

    return i18n.readFinished;
  }
}
