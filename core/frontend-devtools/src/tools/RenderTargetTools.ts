/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  PrimitiveVisibility,
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

/** Control whether all geometry renders, or only instanced or batched geometry.
 * Allowed argument: "instanced", "batched", "all". Defaults to "all" if no arguments supplied.
 * @beta
 */
export class TogglePrimitiveVisibilityTool extends RenderTargetDebugControlTool {
  public static toolId = "TogglePrimitiveVisibility";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  private _visibility = PrimitiveVisibility.All;

  public execute(control: RenderTargetDebugControl, vp: ScreenViewport): void {
    control.primitiveVisibility = this._visibility;
    vp.invalidateScene();
  }

  public parseAndRun(...args: string[]): boolean {
    if (0 < args.length) {
      switch (args[0].toLowerCase()) {
        case "instanced":
          this._visibility = PrimitiveVisibility.Instanced;
          break;
        case "batched":
          this._visibility = PrimitiveVisibility.Uninstanced;
          break;
        case "all":
          break;
        default:
          return true;
      }
    }

    return this.run(args);
  }
}

/** Sets support for intersecting volume classifiers.
 * @internal
 */
export class SetVolClassIntersectOn extends RenderTargetDebugControlTool {
  public static toolId = "VCIntersectOn";
  public execute(control: RenderTargetDebugControl, vp: ScreenViewport): void {
    control.vcSupportIntersectingVolumes = true;
    vp.invalidateRenderPlan();
  }
}

/** Sets support for intersecting volume classifiers.
 * @internal
 */
export class SetVolClassIntersectOff extends RenderTargetDebugControlTool {
  public static toolId = "VCIntersectOff";
  public execute(control: RenderTargetDebugControl, vp: ScreenViewport): void {
    control.vcSupportIntersectingVolumes = false;
    vp.invalidateRenderPlan();
  }
}
