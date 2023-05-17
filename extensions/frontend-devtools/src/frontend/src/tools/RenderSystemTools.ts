/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { IModelApp, NotifyMessageDetails, OutputMessagePriority, RenderSystemDebugControl, Tool } from "@itwin/core-frontend";
import { parseToggle } from "./parseToggle";

/** Executes some code against a RenderSystemDebugControl obtained from the IModelApp's RenderSystem.
 * @beta
 */
export abstract class RenderSystemDebugControlTool extends Tool {
  public override async run(_args: any[]): Promise<boolean> {
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
  public static override toolId = "LoseWebGLContext";
  public execute(control: RenderSystemDebugControl): void {
    control.loseContext();
  }
}

/** Compiles all registered shader programs for which compilation has not already been attempted.
 * This is useful for uncovering/debugging platform-specific shader issues.
 * @beta
 */
export class CompileShadersTool extends RenderSystemDebugControlTool {
  public static override toolId = "CompileShaders";
  public execute(control: RenderSystemDebugControl): void {
    const compiled = control.compileAllShaders();
    IModelApp.notifications.outputMessage(new NotifyMessageDetails(compiled ? OutputMessagePriority.Info : OutputMessagePriority.Error, `${compiled ? "No" : "Some"} compilation errors occurred.`));
  }
}

/** Toggles whether or not device pixel ratio should be taken into account when computing LOD for tiles and decoration graphics.
 * @see [RenderSystem.Options.dpiAwareLOD]($frontend)
 * @beta
 */
export class ToggleDPIForLODTool extends RenderSystemDebugControlTool {
  public static override toolId = "ToggleDPIForLOD";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  private _enable?: boolean;

  public execute(control: RenderSystemDebugControl): void {
    const enable = this._enable ?? !control.dpiAwareLOD;
    control.dpiAwareLOD = enable;
    IModelApp.viewManager.invalidateViewportScenes();
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string") {
      this._enable = enable;
      await this.run([]);
    }

    return true;
  }
}
