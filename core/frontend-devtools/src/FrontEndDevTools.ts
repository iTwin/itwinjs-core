/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ChangeEmphasisSettingsTool, ChangeHiliteSettingsTool, DefaultTileSizeModifierTool, FadeOutTool, FreezeSceneTool, SetAspectRatioSkewTool, ShowTileVolumesTool, Toggle3dManipulationsTool, ToggleViewAttachmentBoundariesTool, ToggleViewAttachmentClipShapesTool, ToggleViewAttachmentsTool, ViewportAddRealityModel, ViewportTileSizeModifierTool } from "./frontend-devtools";
import { AnimationIntervalTool } from "./tools/AnimationIntervalTool";
import { ChangeUnitsTool } from "./tools/ChangeUnitsTool";
import { ClipColorTool } from "./tools/ClipColorTool";
import { ApplyRenderingStyleTool, ChangeViewFlagsTool, SaveRenderingStyleTool, ToggleSkyboxTool } from "./tools/DisplayStyleTools";
import { ClearIsolatedElementsTool, EmphasizeSelectedElementsTool, IsolateSelectedElementsTool } from "./tools/EmphasizeElementsTool";
import { ExtensionServiceTool } from "./tools/ExtensionServiceTool";
import { ToggleFrustumSnapshotTool, ToggleSelectedViewFrustumTool, ToggleShadowFrustumTool } from "./tools/FrustumDecoration";
import { InspectElementTool } from "./tools/InspectElementTool";
import { AttachArcGISMapLayerByUrlTool, AttachMapLayerTool, AttachMapOverlayTool, AttachTileURLMapLayerByUrlTool, AttachWmsMapLayerByUrlTool, AttachWmtsMapLayerByUrlTool, DetachMapLayersTool, MapBaseColorTool, MapBaseTransparencyTool, MapLayerSubLayerVisiblityTool, MapLayerTransparencyTool, MapLayerVisibilityTool, MapLayerZoomTool, ReorderMapLayers, SetMapBaseTool, ToggleTerrainTool } from "./tools/MapLayerTool";
import { MeasureTileLoadTimeTool } from "./tools/MeasureTileLoadTime";
import { ClearModelAppearanceOverrides, SetModelColorTool, SetModelEmphasizedTool, SetModelIgnoresMaterialsTool, SetModelLineCodeTool, SetModelLineWeightTool, SetModelLocateTool, SetModelTransparencyTool } from "./tools/ModelAppearanceTools";
import { ChangePlanProjectionSettingsTool, DumpPlanProjectionSettingsTool, OverrideSubCategoryPriorityTool } from "./tools/PlanProjectionTools";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents";
import { AttachCesiumAssetTool, AttachRealityModelTool, ClearRealityModelAppearanceOverrides, DetachRealityModelTool, SaveRealityModelTool, SetRealityModelColorTool, SetRealityModelEmphasizedTool, SetRealityModelLocateTool, SetRealityModelTransparencyTool, ToggleOSMBuildingDisplay } from "./tools/RealityModelTools";
import { RealityTransitionTool } from "./tools/RealityTransitionTool";
import { CompileShadersTool, LoseWebGLContextTool, ToggleDPIForLODTool, ToggleWiremeshTool } from "./tools/RenderSystemTools";
import { SetAASamplesTool, ToggleDrapeFrustumTool, TogglePrimitiveVisibilityTool, ToggleReadPixelsTool, ToggleRealityTileBounds, ToggleRealityTileFreeze, ToggleRealityTileLogging, ToggleRealityTilePreload, ToggleVolClassIntersect } from "./tools/RenderTargetTools";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import { ApplyViewByIdTool, ApplyViewTool, SaveViewTool } from "./tools/SavedViews";
import { SelectElementsByIdTool } from "./tools/SelectionTools";
import { ElementIdFromSourceAspectIdTool, SourceAspectIdFromElementIdTool } from "./tools/SourceAspectIdTools";
import { ToggleTileRequestDecorationTool } from "./tools/TileRequestDecoration";
import { ToggleTileTreeBoundsDecorationTool } from "./tools/TileTreeBoundsDecoration";
import { ToggleToolTipsTool } from "./tools/ToolTipProvider";

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
      return;

    this._initialized = true;

    const i18n = IModelApp.i18n.registerNamespace("FrontendDevTools");
    const tools = [
      AttachMapLayerTool,
      AttachMapOverlayTool,
      AttachArcGISMapLayerByUrlTool,
      AttachWmsMapLayerByUrlTool,
      AttachWmtsMapLayerByUrlTool,
      AttachTileURLMapLayerByUrlTool,
      AnimationIntervalTool,
      ApplyRenderingStyleTool,
      ApplyViewByIdTool,
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
      DetachMapLayersTool,
      DumpPlanProjectionSettingsTool,
      ElementIdFromSourceAspectIdTool,
      EmphasizeSelectedElementsTool,
      ExtensionServiceTool,
      FadeOutTool,
      FreezeSceneTool,
      InspectElementTool,
      IsolateSelectedElementsTool,
      LoseWebGLContextTool,
      MapLayerTransparencyTool,
      MapLayerVisibilityTool,
      MapLayerSubLayerVisiblityTool,
      MapLayerZoomTool,
      MapBaseColorTool,
      MapBaseTransparencyTool,
      MeasureTileLoadTimeTool,
      OverrideSubCategoryPriorityTool,
      RealityTransitionTool,
      ReorderMapLayers,
      ReportWebGLCompatibilityTool,
      SaveRenderingStyleTool,
      SaveViewTool,
      SelectElementsByIdTool,
      SetAASamplesTool,
      SetAspectRatioSkewTool,
      ToggleVolClassIntersect,
      SetMapBaseTool,
      ShowTileVolumesTool,
      SourceAspectIdFromElementIdTool,
      Toggle3dManipulationsTool,
      ToggleDPIForLODTool,
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
      ToggleViewAttachmentBoundariesTool,
      ToggleViewAttachmentClipShapesTool,
      ToggleViewAttachmentsTool,
      ToggleWiremeshTool,
      ToggleRealityTileBounds,
      ToggleRealityTilePreload,
      ToggleRealityTileLogging,
      ToggleRealityTileFreeze,
      ToggleTerrainTool,
      ViewportAddRealityModel,
      ViewportTileSizeModifierTool,
      AttachRealityModelTool,
      DetachRealityModelTool,
      SaveRealityModelTool,
      SetRealityModelLocateTool,
      SetRealityModelEmphasizedTool,
      SetRealityModelTransparencyTool,
      SetRealityModelColorTool,
      SetModelLocateTool,
      SetModelEmphasizedTool,
      SetModelTransparencyTool,
      SetModelColorTool,
      SetModelLineWeightTool,
      SetModelLineCodeTool,
      SetModelIgnoresMaterialsTool,
      ClearRealityModelAppearanceOverrides,
      ClearModelAppearanceOverrides,
      AttachCesiumAssetTool,
      ToggleOSMBuildingDisplay,
    ];

    for (const tool of tools)
      tool.register(i18n);

    return i18n.readFinished;
  }
}
