/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  NotifyMessageDetails,
  OutputMessagePriority,
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

/** Compiles all registered shader programs for which compilation has not already been attempted.
 * This is useful for uncovering/debugging platform-specific shader issues.
 * @beta
 */
export class CompileShadersTool extends RenderSystemDebugControlTool {
  public static toolId = "CompileShaders";
  public execute(control: RenderSystemDebugControl): void {
    const compiled = control.compileAllShaders();
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(compiled ? OutputMessagePriority.Info : OutputMessagePriority.Error, (compiled ? "No" : "Some") + " compilation errors occurred."));
  }
}
