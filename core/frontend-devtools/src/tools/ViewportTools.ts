/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

/** @module Tools */

import {
  ColorDef,
  Hilite,
} from "@bentley/imodeljs-common";
import {
  IModelApp,
  Tile,
  Tool,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { parseToggle } from "./parseToggle";

/** Freeze or unfreeze the scene for the selected viewport. While the scene is frozen, no new tiles will be selected for drawing within the viewport.
 * @beta
 */
export class FreezeSceneTool extends Tool {
  public static toolId = "FreezeScene";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (undefined === enable || enable !== vp.freezeScene))
      vp.freezeScene = !vp.freezeScene;

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}

const boundingVolumeNames = [
  "none",
  "volume",
  "content",
  "both",
  "children",
  "sphere",
];

/** Set the tile bounding volume decorations to display in the selected viewport.
 * Omitting the argument turns on Volume bounding boxes.
 * Allowed inputs are "none", "volume", "content", "both" (volume and content), "children", and "sphere".
 * @beta
 */
export class ShowTileVolumesTool extends Tool {
  public static toolId = "ShowTileVolumes";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(boxes?: Tile.DebugBoundingBoxes): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined === boxes)
      boxes = Tile.DebugBoundingBoxes.Volume;

    vp.debugBoundingBoxes = boxes;
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    let boxes: Tile.DebugBoundingBoxes | undefined;
    if (0 !== args.length) {
      const arg = args[0].toLowerCase();
      for (let i = 0; i < boundingVolumeNames.length; i++) {
        if (arg === boundingVolumeNames[i]) {
          boxes = i;
          break;
        }
      }

      if (undefined === boxes)
        return true;
    }

    return this.run(boxes);
  }
}

/** @alpha */
export class SetAspectRatioSkewTool extends Tool {
  public static toolId = "SetAspectRatioSkew";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(skew?: number): boolean {
    if (undefined === skew)
      skew = 1.0;

    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp) {
      vp.view.setAspectRatioSkew(skew);
      vp.synchWithView();
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const skew = args.length > 0 ? parseFloat(args[0]) : 1.0;
    return !Number.isNaN(skew) && this.run(skew);
  }
}

/** Changes the selected viewport's hilite or emphasis settings.
 * @beta
 */
export abstract class ChangeHiliteTool extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 6; }

  public run(settings?: Hilite.Settings): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      this.apply(vp, settings);

    return true;
  }

  protected abstract apply(vp: Viewport, settings: Hilite.Settings | undefined): void;
  protected abstract getCurrentSettings(vp: Viewport): Hilite.Settings;

  public parseAndRun(...args: string[]): boolean {
    if (0 === args.length)
      return this.run();

    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    const cur = this.getCurrentSettings(vp);
    const colors = cur.color.colors;
    let visible = cur.visibleRatio;
    let hidden = cur.hiddenRatio;
    let silhouette = cur.silhouette;

    const parseColorComponent = (x: string, c: "r" | "g" | "b") => {
      const num = parseInt(x, 10);
      if (!Number.isNaN(num))
        colors[c] = Math.floor(Math.max(0, Math.min(255, num)));
    };

    for (const arg of args) {
      const parts = arg.split("=");
      if (2 !== parts.length)
        return true;

      const key = parts[0][0].toLowerCase();
      const value = parts[1];
      switch (key) {
        case "r": parseColorComponent(value, "r"); break;
        case "g": parseColorComponent(value, "g"); break;
        case "b": parseColorComponent(value, "b"); break;
        case "s": {
          const n = parseInt(value, 10);
          if (n >= Hilite.Silhouette.None && n <= Hilite.Silhouette.Thick)
            silhouette = n;

          break;
        }
        case "v":
        case "h": {
          const s = parseFloat(value);
          if (s >= 0.0 && s <= 1.0) {
            if ("v" === key)
              visible = s;
            else
              hidden = s;
          }

          break;
        }
      }
    }

    if (undefined === silhouette) silhouette = cur.silhouette;
    if (undefined === visible) visible = cur.visibleRatio;
    if (undefined === hidden) hidden = cur.hiddenRatio;

    const settings: Hilite.Settings = {
      color: ColorDef.from(colors.r, colors.g, colors.b),
      silhouette,
      visibleRatio: visible,
      hiddenRatio: hidden,
    };

    return this.run(settings);
  }
}

/** Changes the selected viewport's hilite settings, or resets to defaults.
 * @beta
 */
export class ChangeHiliteSettingsTool extends ChangeHiliteTool {
  public static toolId = "ChangeHiliteSettings";

  protected getCurrentSettings(vp: Viewport) { return vp.hilite; }
  protected apply(vp: Viewport, settings?: Hilite.Settings): void {
    vp.hilite = undefined !== settings ? settings : new Hilite.Settings();
  }
}

/** Changes the selected viewport's emphasis settings.
 * @beta
 */
export class ChangeEmphasisSettingsTool extends ChangeHiliteTool {
  public static toolId = "ChangeEmphasisSettings";

  protected getCurrentSettings(vp: Viewport) { return vp.emphasisSettings; }
  protected apply(vp: Viewport, settings?: Hilite.Settings): void {
    if (undefined !== settings)
      vp.emphasisSettings = settings;
  }
}

/** Enables or disables fade-out transparency mode for the selected viewport.
 * @beta
 */
export class FadeOutTool extends Tool {
  public static toolId = "FadeOut";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp && (undefined === enable || enable !== vp.isFadeOutActive))
      vp.isFadeOutActive = !vp.isFadeOutActive;

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}

/** Sets the default tile size modifier used for all viewports that don't explicitly override it.
 * @alpha
 */
export class DefaultTileSizeModifierTool extends Tool {
  public static toolId = "DefaultTileSizeMod";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(modifier?: number): boolean {
    if (undefined !== modifier)
      IModelApp.tileAdmin.defaultTileSizeModifier = modifier;

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(Number.parseFloat(args[0]));
  }
}

/** Sets or clears the tile size modifier override for the selected viewport.
 * @alpha
 */
export class ViewportTileSizeModifierTool extends Tool {
  public static toolId = "ViewportTileSizeMod";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(modifier?: number): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.setTileSizeModifier(modifier);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const arg = args[0].toLowerCase();
    const modifier = "reset" === arg ? undefined : Number.parseFloat(args[0]);
    return this.run(modifier);
  }
}

/** Sets or clears the tile size modifier override for the selected viewport.
 * @alpha
 */
export class ViewportAddRealityModel extends Tool {
  public static toolId = "ViewportAddRealityModel";
  public static get minArgs() { return 1; }
  public static get maxArgs() { return 1; }

  public run(url: string): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      vp.displayStyle.attachRealityModel({ tilesetUrl: url });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}
