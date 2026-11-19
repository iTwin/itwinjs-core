/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { Range3d } from "@itwin/core-geometry";
import { ColorDef } from "@itwin/core-common";
import { DecorateContext, GraphicType, IModelApp, Tool, Viewport } from "@itwin/core-frontend";
import { parseArgs } from "@itwin/frontend-devtools";

/** Draws boxes above and below the viewed extents of a spatial view - outside of the volume normally encompassed by the frustum's
 * front and back planes. If `expandFrustumDepth` is enabled, the frustum's depth is expanded to include the boxes so they are always
 * fully displayed; otherwise, portions of them are clipped by the front and back planes depending on the camera.
 */
class FrustumDepthDecorator {
  private static _instance?: FrustumDepthDecorator;
  public readonly useCachedDecorations = true;
  public readonly expandFrustumDepth?: true;
  private readonly _ranges: Range3d[];

  private constructor(vp: Viewport, expand: boolean) {
    if (expand)
      this.expandFrustumDepth = true;

    // Position one box above and one below the viewed extents, outside the depth range the frustum would normally encompass.
    const extents = vp.view.getViewedExtents();
    const dz = Math.max(extents.zLength(), 1);
    const cx = extents.center.x;
    const cy = extents.center.y;
    const rx = Math.max(extents.xLength() / 8, 0.5);
    const ry = Math.max(extents.yLength() / 8, 0.5);
    this._ranges = [
      new Range3d(cx - rx, cy - ry, extents.high.z + dz / 2, cx + rx, cy + ry, extents.high.z + dz),
      new Range3d(cx - rx, cy - ry, extents.low.z - dz, cx + rx, cy + ry, extents.low.z - dz / 2),
    ];
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.isSpatialView())
      return;

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    builder.setSymbology(ColorDef.red, ColorDef.red, 3);
    for (const range of this._ranges)
      builder.addRangeBox(range);

    context.addDecorationFromBuilder(builder);
  }

  public static toggle(vp: Viewport, expand: boolean): void {
    const dec = this._instance;
    if (dec) {
      IModelApp.viewManager.dropDecorator(dec);
      this._instance = undefined;
    } else {
      this._instance = new FrustumDepthDecorator(vp, expand);
      IModelApp.viewManager.addDecorator(this._instance);
    }
  }
}

/** Toggles a decoration located outside the selected viewport's viewed extents, for testing `ViewportDecorator.expandFrustumDepth`.
 * By default, the decorator enables `expandFrustumDepth` so the decoration is never clipped by the frustum's front and back planes.
 * Specify `e=0` to disable `expandFrustumDepth` and observe the clipping that occurs without it.
 */
export class ToggleFrustumDepthDecorationTool extends Tool {
  private _expand = true;

  public static override toolId = "ToggleFrustumDepthDecoration";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(): Promise<boolean> {
    const vp = IModelApp.viewManager.selectedView;
    if (vp)
      FrustumDepthDecorator.toggle(vp, this._expand);

    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const parsedArgs = parseArgs(args);
    this._expand = parsedArgs.getBoolean("e") ?? true;
    return this.run();
  }
}
