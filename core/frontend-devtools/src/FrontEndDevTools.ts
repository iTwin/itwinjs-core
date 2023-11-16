/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { IModelApp } from "@itwin/core-frontend";
import { EdgeDetectionEffect, EmbossEffect, GaussianBlurEffect, SharpenEffect, SharpnessEffect, UnsharpenEffect } from "./effects/Convolution";
import { ClearEffectsTool } from "./effects/EffectTools";
import { ExplosionEffect } from "./effects/Explosion";
import { FlipImageConfig, FlipImageEffect } from "./effects/FlipImage";
import { LensDistortionConfig, LensDistortionEffect } from "./effects/LensDistortion";
import { SaturationConfig, SaturationEffect } from "./effects/Saturation";
import { SnowEffect } from "./effects/Snow";
import { VignetteConfig, VignetteEffect } from "./effects/Vignette";
import {
  MaskBackgroundMapByElementTool, MaskBackgroundMapByExcludedElementTool, MaskBackgroundMapByModelTool, MaskBackgroundMapBySubCategoryTool, MaskRealityModelByElementTool, MaskRealityModelByExcludedElementTool,
  MaskRealityModelByModelTool, MaskRealityModelBySubCategoryTool, SetHigherPriorityRealityModelMasking, SetMapHigherPriorityMasking, UnmaskMapTool, UnmaskRealityModelTool,
} from "./tools/PlanarMaskTools";
import {
  ChangeCameraTool, ChangeEmphasisSettingsTool, ChangeFlashSettingsTool, ChangeHiliteModeTool, ChangeHiliteSettingsTool, DefaultTileSizeModifierTool, FadeOutTool,
  FreezeSceneTool, SetAspectRatioSkewTool, ShowTileVolumesTool, Toggle3dManipulationsTool, ToggleDrawingGraphicsTool, ToggleSectionDrawingSpatialViewTool,
  ToggleTileTreeReferencesTool, ToggleViewAttachmentBoundariesTool, ToggleViewAttachmentClipShapesTool, ToggleViewAttachmentsTool, ViewportAddRealityModel,
  ViewportTileSizeModifierTool,
} from "./tools/ViewportTools";
import { AnimationIntervalTool } from "./tools/AnimationIntervalTool";
import { ChangeUnitsTool } from "./tools/ChangeUnitsTool";
import { ClipColorTool, ClipIntersectionTool, TestClipStyleTool, ToggleSectionCutTool } from "./tools/ClipTools";
import {
  ApplyRenderingStyleTool, ChangeBackgroundColorTool, ChangeViewFlagsTool, OverrideSubCategoryTool, SaveRenderingStyleTool, SkyCubeTool,
  SkySphereTool, ToggleSkyboxTool, ToggleWiremeshTool, WoWIgnoreBackgroundTool,
} from "./tools/DisplayStyleTools";
import { QueryScheduleScriptTool, ReverseScheduleScriptTool, SetScheduleScriptTool } from "./tools/ScheduleScriptTools";
import {
  ClearEmphasizedElementsTool, ClearIsolatedElementsTool, EmphasizeSelectedElementsTool, EmphasizeVisibleElementsTool, IsolateSelectedElementsTool,
} from "./tools/EmphasizeElementsTool";
import { ToggleFrustumSnapshotTool, ToggleSelectedViewFrustumTool, ToggleShadowFrustumTool } from "./tools/FrustumDecoration";
import { InspectElementTool } from "./tools/InspectElementTool";
import {
  AttachArcGISFeatureMapLayerByUrlTool,
  AttachArcGISMapLayerByUrlTool, AttachMapLayerTool, AttachMapOverlayTool, AttachModelMapLayerTool, AttachTileURLMapLayerByUrlTool, AttachWmsMapLayerByUrlTool,
  AttachWmtsMapLayerByUrlTool, DetachMapLayersTool, MapBaseColorTool, MapBaseTransparencyTool, MapBaseVisibilityTool, MapLayerSubLayerVisibilityTool,
  MapLayerTransparencyTool, MapLayerVisibilityTool, MapLayerZoomTool, ReorderMapLayers, SetMapBaseTool, ToggleTerrainTool,
} from "./tools/MapLayerTool";
import { MeasureTileLoadTimeTool } from "./tools/MeasureTileLoadTime";
import {
  ClearModelAppearanceOverrides, SetModelColorTool, SetModelEmphasizedTool, SetModelIgnoresMaterialsTool, SetModelLineCodeTool,
  SetModelLineWeightTool, SetModelLocateTool, SetModelTransparencyTool,
} from "./tools/ModelAppearanceTools";
import { ChangePlanProjectionSettingsTool, DumpPlanProjectionSettingsTool, OverrideSubCategoryPriorityTool } from "./tools/PlanProjectionTools";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents";
import {
  AttachCesiumAssetTool, AttachRealityModelTool, ClearRealityModelAppearanceOverrides, DetachRealityModelTool, SaveRealityModelTool,
  SetRealityModelColorTool, SetRealityModelEmphasizedTool, SetRealityModelLocateTool, SetRealityModelTransparencyTool, ToggleOSMBuildingDisplay,
} from "./tools/RealityModelTools";
import { RealityTransitionTool } from "./tools/RealityTransitionTool";
import { CompileShadersTool, LoseWebGLContextTool, ToggleDPIForLODTool } from "./tools/RenderSystemTools";
import {
  SetAASamplesTool, ToggleDrapeFrustumTool, ToggleNormalMaps, TogglePrimitiveVisibilityTool, ToggleReadPixelsTool, ToggleRealityTileBounds, ToggleRealityTileFreeze,
  ToggleRealityTileLogging, ToggleRealityTilePreload, ToggleVolClassIntersect,
} from "./tools/RenderTargetTools";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import { ApplyViewByIdTool, ApplyViewTool, SaveViewTool } from "./tools/SavedViews";
import { DumpSelectionSetTool, SelectElementsByIdTool } from "./tools/SelectionTools";
import { SetGpuMemoryLimitTool } from "./tools/SetGpuMemoryLimitTool";
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

    // clean up if we're being shut down
    IModelApp.onBeforeShutdown.addListener(() => this.shutdown());

    const namespace = "FrontendDevTools";
    const namespacePromise = IModelApp.localization.registerNamespace(namespace);
    const tools = [
      AttachMapLayerTool,
      AttachMapOverlayTool,
      AttachModelMapLayerTool,
      AttachArcGISMapLayerByUrlTool,
      AttachArcGISFeatureMapLayerByUrlTool,
      AttachWmsMapLayerByUrlTool,
      AttachWmtsMapLayerByUrlTool,
      AttachTileURLMapLayerByUrlTool,
      AnimationIntervalTool,
      ApplyRenderingStyleTool,
      ApplyViewByIdTool,
      ApplyViewTool,
      ChangeBackgroundColorTool,
      ChangeCameraTool,
      ChangeEmphasisSettingsTool,
      ChangeFlashSettingsTool,
      ChangeHiliteModeTool,
      ChangeHiliteSettingsTool,
      ChangePlanProjectionSettingsTool,
      ChangeUnitsTool,
      ChangeViewFlagsTool,
      ClearEffectsTool,
      ClearEmphasizedElementsTool,
      ClearIsolatedElementsTool,
      ClipColorTool,
      ClipIntersectionTool,
      CompileShadersTool,
      DefaultTileSizeModifierTool,
      DetachMapLayersTool,
      DumpPlanProjectionSettingsTool,
      DumpSelectionSetTool,
      EdgeDetectionEffect,
      EmbossEffect,
      ElementIdFromSourceAspectIdTool,
      EmphasizeSelectedElementsTool,
      EmphasizeVisibleElementsTool,
      ExplosionEffect,
      FadeOutTool,
      FlipImageConfig,
      FlipImageEffect,
      FreezeSceneTool,
      GaussianBlurEffect,
      InspectElementTool,
      IsolateSelectedElementsTool,
      LensDistortionConfig,
      LensDistortionEffect,
      LoseWebGLContextTool,
      MapLayerTransparencyTool,
      MapLayerVisibilityTool,
      MapLayerSubLayerVisibilityTool,
      MapLayerZoomTool,
      MapBaseColorTool,
      MapBaseTransparencyTool,
      MapBaseVisibilityTool,
      MeasureTileLoadTimeTool,
      OverrideSubCategoryTool,
      OverrideSubCategoryPriorityTool,
      QueryScheduleScriptTool,
      RealityTransitionTool,
      ReorderMapLayers,
      ReportWebGLCompatibilityTool,
      ReverseScheduleScriptTool,
      SaturationConfig,
      SaturationEffect,
      SaveRenderingStyleTool,
      SaveViewTool,
      SelectElementsByIdTool,
      SetAASamplesTool,
      SetAspectRatioSkewTool,
      SetScheduleScriptTool,
      ToggleVolClassIntersect,
      SetMapBaseTool,
      SharpenEffect,
      SharpnessEffect,
      ShowTileVolumesTool,
      SkyCubeTool,
      SkySphereTool,
      SnowEffect,
      SourceAspectIdFromElementIdTool,
      TestClipStyleTool,
      Toggle3dManipulationsTool,
      ToggleDrawingGraphicsTool,
      ToggleDPIForLODTool,
      ToggleDrapeFrustumTool,
      ToggleFrustumSnapshotTool,
      ToggleNormalMaps,
      TogglePrimitiveVisibilityTool,
      ToggleProjectExtentsTool,
      ToggleReadPixelsTool,
      ToggleSectionDrawingSpatialViewTool,
      ToggleSelectedViewFrustumTool,
      ToggleShadowFrustumTool,
      ToggleSkyboxTool,
      ToggleTileRequestDecorationTool,
      ToggleTileTreeBoundsDecorationTool,
      ToggleTileTreeReferencesTool,
      ToggleToolTipsTool,
      ToggleViewAttachmentBoundariesTool,
      ToggleViewAttachmentClipShapesTool,
      ToggleViewAttachmentsTool,
      ToggleWiremeshTool,
      ToggleRealityTileBounds,
      ToggleRealityTilePreload,
      ToggleRealityTileLogging,
      ToggleRealityTileFreeze,
      ToggleSectionCutTool,
      ToggleTerrainTool,
      UnsharpenEffect,
      ViewportAddRealityModel,
      ViewportTileSizeModifierTool,
      VignetteConfig,
      VignetteEffect,
      AttachRealityModelTool,
      DetachRealityModelTool,
      SaveRealityModelTool,
      SetGpuMemoryLimitTool,
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
      SetHigherPriorityRealityModelMasking,
      SetMapHigherPriorityMasking,
      MaskRealityModelByModelTool,
      MaskRealityModelBySubCategoryTool,
      MaskRealityModelByElementTool,
      MaskRealityModelByExcludedElementTool,
      UnmaskRealityModelTool,
      MaskBackgroundMapByModelTool,
      MaskBackgroundMapBySubCategoryTool,
      MaskBackgroundMapByElementTool,
      MaskBackgroundMapByExcludedElementTool,
      UnmaskMapTool,
      WoWIgnoreBackgroundTool,
    ];

    for (const tool of tools)
      tool.register(namespace);

    return namespacePromise;
  }

  private static shutdown() {
    this._initialized = false;
  }
}
