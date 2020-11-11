/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { ColorDef, Hilite } from "@bentley/imodeljs-common";
import { IModelApp, TileBoundingBoxes, Tool, Viewport } from "@bentley/imodeljs-frontend";
import { parseArgs } from "./parseArgs";
import { parseToggle } from "./parseToggle";

/** Base class for a tool that toggles some aspect of a Viewport.
 * @beta
 */
export abstract class ViewportToggleTool extends Tool {
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  protected abstract toggle(vp: Viewport, enable?: boolean): void;

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined !== vp)
      this.toggle(vp, enable);

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}

/** Freeze or unfreeze the scene for the selected viewport. While the scene is frozen, no new tiles will be selected for drawing within the viewport.
 * @beta
 */
export class FreezeSceneTool extends ViewportToggleTool {
  public static toolId = "FreezeScene";

  protected toggle(vp: Viewport, enable?: boolean): void {
    if (undefined === enable || enable !== vp.freezeScene)
      vp.freezeScene = !vp.freezeScene;
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
 * Omitting the argument turns on Volume bounding boxes if bounding boxes are currently off; otherwise, toggles them off.
 * Allowed inputs are "none", "volume", "content", "both" (volume and content), "children", and "sphere".
 * @beta
 */
export class ShowTileVolumesTool extends Tool {
  public static toolId = "ShowTileVolumes";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(boxes?: TileBoundingBoxes): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    if (undefined === boxes)
      boxes = TileBoundingBoxes.None === vp.debugBoundingBoxes ? TileBoundingBoxes.Volume : TileBoundingBoxes.None;

    vp.debugBoundingBoxes = boxes;
    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    let boxes: TileBoundingBoxes | undefined;
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

  public parseAndRun(...inputArgs: string[]): boolean {
    if (0 === inputArgs.length)
      return this.run();

    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp)
      return true;

    const cur = this.getCurrentSettings(vp);
    const colors = cur.color.colors;
    let visible = cur.visibleRatio;
    let hidden = cur.hiddenRatio;
    let silhouette = cur.silhouette;

    const args = parseArgs(inputArgs);
    const parseColorComponent = (c: "r" | "g" | "b") => {
      const num = args.getInteger(c);
      if (undefined !== num)
        colors[c] = Math.floor(Math.max(0, Math.min(255, num)));
    };

    parseColorComponent("r");
    parseColorComponent("g");
    parseColorComponent("b");

    const silhouetteArg = args.getInteger("s");
    if (undefined !== silhouetteArg && silhouetteArg >= Hilite.Silhouette.None && silhouetteArg <= Hilite.Silhouette.Thick)
      silhouette = silhouetteArg;

    const v = args.getFloat("v");
    if (undefined !== v && v >= 0 && v <= 1)
      visible = v;

    const h = args.getFloat("h");
    if (undefined !== h && h >= 0 && h <= 1)
      hidden = h;

    if (undefined === silhouette)
      silhouette = cur.silhouette;

    if (undefined === visible)
      visible = cur.visibleRatio;

    if (undefined === hidden)
      hidden = cur.hiddenRatio;

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
export class FadeOutTool extends ViewportToggleTool {
  public static toolId = "FadeOut";

  protected toggle(vp: Viewport, enable?: boolean): void {
    if (undefined === enable || enable !== vp.isFadeOutActive)
      vp.isFadeOutActive = !vp.isFadeOutActive;
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
      vp.attachRealityModel({ tilesetUrl: url });

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    return this.run(args[0]);
  }
}

/** Changes the `allow3dManipulations` flag for the selected viewport if the viewport is displaying a `ViewState3d`.
 * @alpha
 */
export class Toggle3dManipulationsTool extends ViewportToggleTool {
  public static toolId = "Toggle3dManipulations";

  protected toggle(vp: Viewport, allow?: boolean): void {
    if (!vp.view.is3d())
      return;

    if (undefined === allow)
      allow = !vp.view.allow3dManipulations();

    if (allow !== vp.view.allow3dManipulations()) {
      vp.view.setAllow3dManipulations(allow);
      IModelApp.toolAdmin.startDefaultTool();
    }
  }
}

/** Toggles display of view attachments in sheet views.
 * @beta
 */
export class ToggleViewAttachmentsTool extends ViewportToggleTool {
  public static toolId = "ToggleViewAttachments";

  protected toggle(vp: Viewport, enable?: boolean): void {
    if (undefined === enable || enable !== vp.wantViewAttachments)
      vp.wantViewAttachments = !vp.wantViewAttachments;
  }
}

/** Toggle display of view attachment boundaries in sheet views.
 * @beta
 */
export class ToggleViewAttachmentBoundariesTool extends ViewportToggleTool {
  public static toolId = "ToggleViewAttachmentBoundaries";

  protected toggle(vp: Viewport, enable?: boolean): void {
    if (undefined === enable || enable !== vp.wantViewAttachmentBoundaries)
      vp.wantViewAttachmentBoundaries = !vp.wantViewAttachmentBoundaries;
  }
}

/** Toggle display of view attachment clip shapes in sheet views.
 * @beta
 */
export class ToggleViewAttachmentClipShapesTool extends ViewportToggleTool {
  public static toolId = "ToggleViewAttachmentClipShapes";

  protected toggle(vp: Viewport, enable?: boolean): void {
    if (undefined === enable || enable !== vp.wantViewAttachmentClipShapes)
      vp.wantViewAttachmentClipShapes = !vp.wantViewAttachmentClipShapes;
  }
}
