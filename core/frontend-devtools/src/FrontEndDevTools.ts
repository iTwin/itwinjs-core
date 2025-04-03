/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/
/** @packageDocumentation
 * @module Utilities
 */

import { IModelApp } from "@itwin/core-frontend";
import { EdgeDetectionEffect, EmbossEffect, GaussianBlurEffect, SharpenEffect, SharpnessEffect, UnsharpenEffect } from "./effects/Convolution.js";
import { ClearEffectsTool } from "./effects/EffectTools.js";
import { ExplosionEffect } from "./effects/Explosion.js";
import { FlipImageConfig, FlipImageEffect } from "./effects/FlipImage.js";
import { LensDistortionConfig, LensDistortionEffect } from "./effects/LensDistortion.js";
import { SaturationConfig, SaturationEffect } from "./effects/Saturation.js";
import { SnowEffect } from "./effects/Snow.js";
import { VignetteConfig, VignetteEffect } from "./effects/Vignette.js";
import { AnimationIntervalTool } from "./tools/AnimationIntervalTool.js";
import { ChangeUnitsTool } from "./tools/ChangeUnitsTool.js";
import { ClipColorTool, ClipIntersectionTool, TestClipStyleTool, ToggleSectionCutTool } from "./tools/ClipTools.js";
import {
  ApplyRenderingStyleTool, ChangeBackgroundColorTool, ChangeViewFlagsTool, OverrideSubCategoryTool, SaveRenderingStyleTool, SkyCubeTool,
  SkySphereTool, ToggleSkyboxTool, ToggleWiremeshTool, WoWIgnoreBackgroundTool,
} from "./tools/DisplayStyleTools.js";
import {
  ClearEmphasizedElementsTool, ClearIsolatedElementsTool, EmphasizeSelectedElementsTool, EmphasizeVisibleElementsTool, IsolateSelectedElementsTool,
} from "./tools/EmphasizeElementsTool.js";
import { ToggleFrustumSnapshotTool, ToggleSelectedViewFrustumTool, ToggleShadowFrustumTool } from "./tools/FrustumDecoration.js";
import { InspectElementTool } from "./tools/InspectElementTool.js";
import {
  AttachArcGISFeatureMapLayerByUrlTool,
  AttachArcGISMapLayerByUrlTool, AttachMapLayerTool, AttachMapOverlayTool, AttachModelMapLayerTool, AttachOgcApiFeaturesMapLayerTool, AttachTileURLMapLayerByUrlTool, AttachWmsMapLayerByUrlTool,
  AttachWmtsMapLayerByUrlTool, DetachMapLayersTool, MapBaseColorTool, MapBaseTransparencyTool, MapBaseVisibilityTool, MapLayerSubLayerVisibilityTool,
  MapLayerTransparencyTool, MapLayerVisibilityTool, MapLayerZoomTool, ReorderMapLayers, SetMapBaseTool, ToggleTerrainTool,
} from "./tools/MapLayerTool.js";
import { MeasureTileLoadTimeTool } from "./tools/MeasureTileLoadTime.js";
import {
  ClearModelAppearanceOverrides, SetModelColorTool, SetModelEmphasizedTool, SetModelIgnoresMaterialsTool, SetModelLineCodeTool,
  SetModelLineWeightTool, SetModelLocateTool, SetModelTransparencyTool,
} from "./tools/ModelAppearanceTools.js";
import {
  MaskBackgroundMapByElementTool, MaskBackgroundMapByExcludedElementTool, MaskBackgroundMapByModelTool, MaskBackgroundMapBySubCategoryTool, MaskRealityModelByElementTool, MaskRealityModelByExcludedElementTool,
  MaskRealityModelByModelTool, MaskRealityModelBySubCategoryTool, SetHigherPriorityRealityModelMasking, SetMapHigherPriorityMasking, UnmaskMapTool, UnmaskRealityModelTool,
} from "./tools/PlanarMaskTools.js";
import { ChangePlanProjectionSettingsTool, DumpPlanProjectionSettingsTool, OverrideSubCategoryPriorityTool } from "./tools/PlanProjectionTools.js";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents.js";
import {
  AttachCesiumAssetTool, AttachRealityModelTool, ClearRealityModelAppearanceOverrides, DetachRealityModelTool, SaveRealityModelTool,
  SetRealityModelColorTool, SetRealityModelEmphasizedTool, SetRealityModelLocateTool, SetRealityModelTransparencyTool, ToggleOSMBuildingDisplay,
} from "./tools/RealityModelTools.js";
import { RealityTransitionTool } from "./tools/RealityTransitionTool.js";
import { CompileShadersTool, LoseWebGLContextTool, ToggleDPIForLODTool } from "./tools/RenderSystemTools.js";
import {
  SetAASamplesTool, ToggleDrapeFrustumTool, ToggleMaskFrustumTool, ToggleNormalMaps, TogglePrimitiveVisibilityTool, ToggleReadPixelsTool, ToggleRealityTileBounds, ToggleRealityTileFreeze,
  ToggleRealityTileLogging, ToggleRealityTilePreload, ToggleVolClassIntersect,
} from "./tools/RenderTargetTools.js";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool.js";
import { ApplyViewByIdTool, ApplyViewTool, SaveViewTool } from "./tools/SavedViews.js";
import { QueryScheduleScriptTool, ReverseScheduleScriptTool, SetScheduleScriptTool } from "./tools/ScheduleScriptTools.js";
import { DumpSelectionSetTool, SelectElementsByIdTool } from "./tools/SelectionTools.js";
import { SetGpuMemoryLimitTool } from "./tools/SetGpuMemoryLimitTool.js";
import { ElementIdFromSourceAspectIdTool, SourceAspectIdFromElementIdTool } from "./tools/SourceAspectIdTools.js";
import { ToggleTileRequestDecorationTool } from "./tools/TileRequestDecoration.js";
import { ToggleTileTreeBoundsDecorationTool } from "./tools/TileTreeBoundsDecoration.js";
import { ToggleToolTipsTool } from "./tools/ToolTipProvider.js";
import {
  ChangeCameraTool, ChangeEmphasisSettingsTool, ChangeFlashSettingsTool, ChangeHiliteModeTool, ChangeHiliteSettingsTool, DefaultTileSizeModifierTool, FadeOutTool,
  FreezeSceneTool, SetAspectRatioSkewTool, ShowTileVolumesTool, Toggle3dManipulationsTool, ToggleDrawingGraphicsTool, ToggleSectionDrawingSpatialViewTool,
  ToggleTileTreeReferencesTool, ToggleViewAttachmentBoundariesTool, ToggleViewAttachmentClipShapesTool, ToggleViewAttachmentsTool, ViewportAddRealityModel,
  ViewportTileSizeModifierTool,
} from "./tools/ViewportTools.js";

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
      AttachOgcApiFeaturesMapLayerTool,
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
      ToggleMaskFrustumTool,
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
