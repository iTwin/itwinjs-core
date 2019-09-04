/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/

import {
  IModelApp,
  Tile,
  Tool,
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
      vp.synchWithView(false);
    }

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const skew = args.length > 0 ? parseFloat(args[0]) : 1.0;
    return !Number.isNaN(skew) && this.run(skew);
  }
}
