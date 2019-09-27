/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import { IModelApp } from "@bentley/imodeljs-frontend";
import { ReportWebGLCompatibilityTool } from "./tools/ReportWebGLCompatibilityTool";
import {
  ToggleLogZTool,
  TogglePrimitiveVisibilityTool,
  ToggleReadPixelsTool,
} from "./tools/RenderTargetTools";
import {
  LoseWebGLContextTool,
  ToggleWiremeshTool,
} from "./tools/RenderSystemTools";
import {
  ClearIsolatedElementsTool,
  EmphasizeSelectedElementsTool,
  IsolateSelectedElementsTool,
} from "./tools/EmphasizeElementsTool";
import { InspectElementTool } from "./tools/InspectElementTool";
import { ChangeViewFlagsTool, ToggleSkyboxTool } from "./tools/ChangeViewFlagsTool";
import {
  SaveViewTool,
  ApplyViewTool,
} from "./tools/SavedViews";
import { ToggleProjectExtentsTool } from "./tools/ProjectExtents";
import {
  ToggleFrustumSnapshotTool,
  ToggleSelectedViewFrustumTool,
} from "./tools/FrustumDecoration";
import {
  ChangeHiliteSettingsTool,
  FreezeSceneTool,
  SetAspectRatioSkewTool,
  ShowTileVolumesTool,
} from "./tools/ViewportTools";
import { RealityTransitionTool } from "./tools/RealityTransitionTool";
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
      return Promise.resolve();

    this._initialized = true;

    const i18n = IModelApp.i18n.registerNamespace("FrontendDevTools");

    InspectElementTool.register(i18n);
    ReportWebGLCompatibilityTool.register(i18n);

    LoseWebGLContextTool.register(i18n);
    ToggleWiremeshTool.register(i18n);

    ToggleReadPixelsTool.register(i18n);
    ToggleLogZTool.register(i18n);
    TogglePrimitiveVisibilityTool.register(i18n);

    ClearIsolatedElementsTool.register(i18n);
    EmphasizeSelectedElementsTool.register(i18n);
    IsolateSelectedElementsTool.register(i18n);

    ChangeViewFlagsTool.register(i18n);
    ToggleSkyboxTool.register(i18n);

    SaveViewTool.register(i18n);
    ApplyViewTool.register(i18n);

    ToggleProjectExtentsTool.register(i18n);
    ToggleFrustumSnapshotTool.register(i18n);
    ToggleSelectedViewFrustumTool.register(i18n);
    ToggleToolTipsTool.register(i18n);

    FreezeSceneTool.register(i18n);
    SetAspectRatioSkewTool.register(i18n);
    ShowTileVolumesTool.register(i18n);
    ChangeHiliteSettingsTool.register(i18n);

    RealityTransitionTool.register(i18n);

    return i18n.readFinished;
  }
}
