/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { IModelApp, Pixel, Tool, ViewRect } from "@itwin/core-frontend";

/** Deterministically reproduces the GL_INVALID_FRAMEBUFFER_OPERATION described in iTwin/itwinjs-core#8256.
 *
 * When a viewport switches back to on-screen rendering (e.g. after a second viewport is
 * dropped), `Target.setRenderToScreen(true)` calls `SceneCompositor.forceBufferChange()`, flagging the compositor
 * for lazy re-init on the next `preDraw()`. If a `readPixels()` (hover pick) runs before the next full frame, the
 * compositor re-inits while the small pick framebuffer is bound, so `opaqueAll` grabs the pick texture as color
 * attachment 0 (via `frameBufferStack.currentColorBuffer`) - mismatched against the viewport-sized attachments.
 *
 * This tool forces that exact ordering synchronously.
 */
export class ReproInvalidFramebufferTool extends Tool {
  public static override toolId = "ReproInvalidFramebuffer";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 0; }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return false;

    // Reproduce the "dropped a second viewport" transition: toggling back to on-screen rendering invokes
    // Target.setRenderToScreen(true) -> SceneCompositor.forceBufferChange(), which sets the compositor's
    // cached width/height to -1 so it re-initializes on the next preDraw().
    vp.rendersToScreen = false;
    vp.rendersToScreen = true;

    // Pick a small region, exactly like a hover pick. readPixels() runs synchronously here - before the render
    // loop paints a frame - so the lazy compositor init happens while the small pick FBO is bound.
    const rect = new ViewRect(0, 0, 8, 8);
    vp.readPixels(rect, Pixel.Selector.Feature, () => { }, true);

    return true;
  }
}
