/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
  DisplayStyle3dState,
  Environment,
  IModelApp,
  Tool,
  Viewport,
} from "@bentley/imodeljs-frontend";
import {
  RenderMode,
  ViewFlags,
} from "@bentley/imodeljs-common";

type BooleanFlagName =
  "dimensions" | "patterns" | "weights" | "styles" | "transparency" | "fill" | "textures" | "materials" | "acsTriad" | "grid" | "visibleEdges" |
  "hiddenEdges" | "lighting" | "shadows" | "clipVolume" | "constructions" | "monochrome" | "backgroundMap" | "ambientOcclusion" | "forceSurfaceDiscard";

// Compiler has the info to construct this array for us, but we have no access to it...
const booleanFlagNames: BooleanFlagName[] = [
  "dimensions", "patterns", "weights", "styles", "transparency", "fill", "textures", "materials", "acsTriad", "grid", "visibleEdges",
  "hiddenEdges", "lighting", "shadows", "clipVolume", "constructions", "monochrome", "backgroundMap", "ambientOcclusion", "forceSurfaceDiscard",
];

const lowercaseBooleanFlagNames = booleanFlagNames.map((name) => name.toLowerCase());

/** Modifies the selected viewport's DisplayStyleState.
 * @beta
 */
export abstract class DisplayStyleTool extends Tool {
  protected get require3d() { return false; }
  // Return true if the display style was modified - we will invalidate the viewport's render plan.
  protected abstract execute(vp: Viewport): boolean;
  // Return false if failed to parse.
  protected abstract parse(args: string[]): boolean;

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.execute(vp))
      vp.displayStyle = vp.view.displayStyle;

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (!this.require3d || vp.view.is3d()) && this.parse(args))
      return this.run();
    else
      return false;
  }
}

/** Modifies the selected viewport's ViewFlags.
 * The keyin syntax is as follows:
 *  fdt change viewflags flag=value
 * Where 'flag' is one of the BooleanFlagName values, or "renderMode"; and value is an integer.
 * For boolean flags, value is 0 for false or 1 for true. For renderMode, value is one of the RenderMode enum values.
 * Flag names are case-insensitive.
 * @beta
 */
export class ChangeViewFlagsTool extends Tool {
  public static toolId = "ChangeViewFlags";
  public static get maxArgs() { return undefined; }
  public static get minArgs() { return 1; }

  public run(vf: ViewFlags, vp?: Viewport): boolean {
    if (undefined !== vf && undefined !== vp)
      vp.viewFlags = vf;

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || 0 === args.length)
      return true;

    const vf = vp.viewFlags.clone();
    for (const arg of args) {
      const parts = arg.split("=");
      if (2 !== parts.length)
        continue;

      const value = parseInt(parts[1], 10);
      if (Number.isNaN(value))
        continue;

      const name = parts[0].toLowerCase();
      if (name === "rendermode") {
        switch (value) {
          case RenderMode.SmoothShade:
          case RenderMode.Wireframe:
          case RenderMode.HiddenLine:
          case RenderMode.SolidFill:
            vf.renderMode = value;
            vp.invalidateRenderPlan();
            break;
        }

        continue;
      }

      if (0 !== value && 1 !== value)
        continue;

      const index = lowercaseBooleanFlagNames.indexOf(name);
      if (-1 !== index) {
        const propName = booleanFlagNames[index];
        vf[propName] = 0 !== value;
        vp.invalidateRenderPlan();
      }
    }

    return this.run(vf, vp);
  }
}

/** Toggles the skybox.
 * @beta
 */
export class ToggleSkyboxTool extends DisplayStyleTool {
  public static toolId = "ToggleSkybox";

  public get require3d() { return true; }

  public parse(_args: string[]) { return true; } // no arguments

  public execute(vp: Viewport): boolean {
    const style = vp.view.displayStyle as DisplayStyle3dState;
    style.environment = new Environment({ sky: { display: !style.environment.sky.display } });
    return true;
  }
}
