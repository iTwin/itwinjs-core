/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  RenderSystemDebugControl,
  Tool,
} from "@bentley/imodeljs-frontend";

/** Executes some code against a RenderSystemDebugControl obtained from the IModelApp's RenderSystem.
 * @beta
 */
export abstract class RenderSystemDebugControlTool extends Tool {
  public run(_args: any[]): boolean {
    const control = IModelApp.renderSystem.debugControl;
    if (undefined !== control)
      this.execute(control);

    return true;
  }

  protected abstract execute(_control: RenderSystemDebugControl): void;
}

/** Forces webgl context loss.
 * @beta
 */
export class LoseWebGLContextTool extends RenderSystemDebugControlTool {
  public static toolId = "LoseWebGLContext";
  public execute(control: RenderSystemDebugControl): void {
    control.loseContext();
  }
}

/** Toggles pseudo-wiremesh surface display, for better visualization of mesh faces.
 * @beta
 */
export class ToggleWiremeshTool extends RenderSystemDebugControlTool {
  public static toolId = "ToggleWiremesh";
  public execute(control: RenderSystemDebugControl): void {
    control.drawSurfacesAsWiremesh = !control.drawSurfacesAsWiremesh;
  }
}
