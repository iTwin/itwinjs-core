/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import {
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
 * ###TODO Generalize this to modify any aspect of display style.
 * @beta
 */
export class ToggleSkyboxTool extends Tool {
  public static toolId = "ToggleSkybox";

  public run(): boolean {
    const vp = IModelApp.viewManager.selectedView;
    const view = undefined !== vp ? vp.view : undefined;
    if (undefined !== view && view.is3d()) {
      const style = view.getDisplayStyle3d();
      style.environment = new Environment({ sky: { display: !style.environment.sky.display } });
      vp!.invalidateRenderPlan();
    }

    return true;
  }
}
