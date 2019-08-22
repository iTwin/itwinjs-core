/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  RenderTargetDebugControl,
  ScreenViewport,
  Tool,
} from "@bentley/imodeljs-frontend";

/** Executes some code against a RenderTargetDebugControl obtained from the selected viewport.
 * @beta
 */
export abstract class RenderTargetDebugControlTool extends Tool {
  public run(_args: any[]): boolean {
    const view = IModelApp.viewManager.selectedView;
    const control = undefined !== view ? view.target.debugControl : undefined;
    if (undefined !== control)
      this.execute(control, view!);

    return true;
  }

  protected abstract execute(_control: RenderTargetDebugControl, _vp: ScreenViewport): void;
}

/** Toggles between normal rendering and rendering as if drawing to an off-screen framebuffer for element locate. Useful for debugging locate issues.
 * @beta
 */
export class ToggleReadPixelsTool extends RenderTargetDebugControlTool {
  public static toolId = "ToggleReadPixels";
  public execute(control: RenderTargetDebugControl, vp: ScreenViewport): void {
    control.drawForReadPixels = !control.drawForReadPixels;
    vp.invalidateScene();
  }
}

/** The first time this tool runs, it disables the use of logarithmic depth buffer-enabled shaders. The second time, it re-enables them.
 * This affects *only* the choice of shader programs. It does not affect the frustum nor does it override the RenderSystem.Options.logarithmicDepthBuffer option.
 * @alpha
 */
export class ToggleLogZTool extends RenderTargetDebugControlTool {
  public static toolId = "ToggleLogZ";
  public execute(control: RenderTargetDebugControl, vp: ScreenViewport): void {
    control.useLogZ = !control.useLogZ;
    vp.invalidateRenderPlan();
  }
}
