/*---------------------------------------------------------------------------------------------
* Copyright (c) 2019 Bentley Systems, Incorporated. All rights reserved.
* Licensed under the MIT License. See LICENSE.md in the project root for license terms.
*--------------------------------------------------------------------------------------------*/
import {
  ClipUtilities,
  ConvexClipPlaneSet,
  Point3d,
  Range3d,
} from "@bentley/geometry-core";
import {
  ColorDef,
  FrustumPlanes,
  LinePixels,
} from "@bentley/imodeljs-common";
import {
  CoordSystem,
  DecorateContext,
  GraphicType,
  IModelApp,
  Tool,
  Viewport,
} from "@bentley/imodeljs-frontend";
import { parseToggle } from "@bentley/frontend-devtools";

class FrustumIntersectionDecoration {
  private static _decorator?: FrustumIntersectionDecoration;
  private readonly _vp: Viewport;
  private _range: Range3d;
  private _removeListeners?: () => void;

  public constructor(vp: Viewport, range: Range3d) {
    this._vp = vp;
    this._range = range;

    const removeDecorator = IModelApp.viewManager.addDecorator(this);
    const removeViewChanged = vp.onViewChanged.addListener(this.onViewChanged, this);
    this._removeListeners = () => { removeDecorator(); removeViewChanged(); this._removeListeners = undefined; };
    IModelApp.viewManager.invalidateDecorationsAllViews();
    vp.invalidateScene();
  }

  private stop(): void {
    if (undefined !== this._removeListeners)
      this._removeListeners();

    IModelApp.viewManager.invalidateDecorationsAllViews();
  }

  private onViewChanged(vp: Viewport): void {
    if (vp === this._vp)
      IModelApp.viewManager.forEachViewport((x) => { if (x !== this._vp) vp.invalidateDecorations(); });
  }

  public decorate(context: DecorateContext): void {
    const vp = context.viewport;
    if (vp === this._vp || !this._vp.view.isSpatialView() || !vp.view.isSpatialView())
      return;

    const frustum = this._vp.getFrustum(CoordSystem.World, true);
    const frustumPlanes = ConvexClipPlaneSet.createPlanes(new FrustumPlanes(frustum).planes!);

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    builder.setSymbology(ColorDef.red, ColorDef.red, 1, LinePixels.Code2);
    builder.addRangeBox(this._range);

    builder.setSymbology(ColorDef.blue, ColorDef.blue, 1, LinePixels.Code2);
    builder.addFrustum(frustum);

    builder.setSymbology(ColorDef.green, ColorDef.green, 2, LinePixels.Solid);
    ClipUtilities.announceLoopsOfConvexClipPlaneSetIntersectRange(frustumPlanes, this._range, (array) => {
      const points: Point3d[] = [];
      for (const point of array.points)
        points.push(point);

      builder.addLineString(points);
    }, true, true, false);

    builder.setSymbology(ColorDef.white, ColorDef.white, 2, LinePixels.Solid);
    this._vp.view.forEachModelTreeRef((ref) => {
      const tree = ref.treeOwner.tileTree;
      if (undefined === tree)
        return;

      const range = tree.computeTileRangeForFrustum(this._vp);
      if (undefined !== range)
        builder.addRangeBox(range);
    });

    context.addDecorationFromBuilder(builder);
  }

  public static toggle(vp: Viewport, range: Range3d, enabled?: boolean): boolean {
    const cur = FrustumIntersectionDecoration._decorator;
    if (undefined !== enabled) {
      if ((undefined !== cur) === enabled) {
        if (undefined !== cur) {
          cur._range = range;
          IModelApp.viewManager.invalidateDecorationsAllViews();
        }

        return enabled;
      }
    }

    if (undefined === cur) {
      FrustumIntersectionDecoration._decorator = new FrustumIntersectionDecoration(vp, range);
      return true;
    } else {
      cur.stop();
      FrustumIntersectionDecoration._decorator = undefined;
      return false;
    }
  }

  public static stop(): void {
    if (undefined !== FrustumIntersectionDecoration._decorator) {
      FrustumIntersectionDecoration._decorator.stop();
      FrustumIntersectionDecoration._decorator = undefined;
    }
  }
}

/** Decorates all viewports except the selected viewport with a graphical depication of the selected viewport's frustum intersected with some range.
 * Useful when e.g. the range comes from a tile tree or tile.
 * Not at all useful if only one viewport is open.
 */
export class ToggleFrustumIntersectionTool extends Tool {
  public static toolId = "ToggleFrustumIntersection";
  public static get minArgs() { return 0; }
  public static get maxArgs() { return 1; }

  public run(enable?: boolean): boolean {
    const vp = IModelApp.viewManager.selectedView;
    if (undefined === vp || !vp.view.isSpatialView())
      return false;

    const range = vp.iModel.projectExtents;
    if (FrustumIntersectionDecoration.toggle(vp, range, enable))
      vp.onChangeView.addOnce(() => FrustumIntersectionDecoration.stop());

    return true;
  }

  public parseAndRun(...args: string[]): boolean {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      this.run(enable);

    return true;
  }
}
