/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { ColorDef, Frustum, LinePixels } from "@itwin/core-common";
import { DecorateContext, GraphicType, IModelApp, IModelConnection, OffScreenViewport, Tool, Viewport, ViewRect, ViewState } from "@itwin/core-frontend";
import { parseToggle } from "./parseToggle";
import { Id64, Id64String } from "@itwin/core-bentley";
import { Transform, Vector2d } from "@itwin/core-geometry";

class ViewDefinitionDecoration {
  private static _instance?: ViewDefinitionDecoration;
  private _removeMe?: () => void;

  private constructor() {
    this._removeMe = IModelApp.viewManager.addDecorator(this);
  }

  private stop() {
    if (this._removeMe) {
      this._removeMe();
      this._removeMe = undefined;
    }
  }

  private _viewId?: Id64String;
  private _loading: boolean = false;
  private _preloadedFrustum: Frustum[] = [];

  private async getFrustumForViewId(iModel: IModelConnection, viewId: Id64String, transform: Transform = Transform.createIdentity()): Promise<ViewState> {
    return iModel.views.load(viewId).then((result) => {
      // Use the view extents/delta
      let vector: Vector2d;
      if (result.is2d()) vector = Vector2d.create(result.delta.x, result.delta.y);
      else vector = Vector2d.create(result.getExtents().x, result.getExtents().y);
      // using new ViewRect(0,0,1,1) to copy SectionAttachment
      const vp = OffScreenViewport.create({ view: result, viewRect: new ViewRect(0,0,vector.x,vector.y) });
      const frustum = vp.getFrustum();
      this._preloadedFrustum.push(frustum.transformBy(transform));

      return result;
    })
  }

  public preload(viewport: Viewport) {
    this._loading = true;
    const iModel = viewport.iModel;
    const view = viewport.view;
    const viewId = view.id;

    const loadPromises: Promise<ViewState>[] = [];
    loadPromises.push(this.getFrustumForViewId(iModel, viewId));

    if (view.isDrawingView() && view.sectionDrawingInfo.spatialView)
      loadPromises.push(this.getFrustumForViewId(iModel, view.sectionDrawingInfo.spatialView, view.sectionDrawingInfo.drawingToSpatialTransform.inverse()));

    void Promise.all(loadPromises).finally(() => {
      IModelApp.viewManager.invalidateCachedDecorationsAllViews(this);
      this._viewId = viewId;
      this._loading = false
    });
  }

  /** This will allow the render system to cache and reuse the decorations created by this decorator's decorate() method. */
  public readonly useCachedDecorations = true;

  public decorate(context: DecorateContext): void {
    if (context.viewport.view.id !== this._viewId && !this._loading) {
      this._preloadedFrustum.length = 0;
      // just clear the decoration if the view is not from a view definition
      if (Id64.isInvalid(context.viewport.view.id)) return;
      try {
        this.preload(context.viewport);
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.log(err);
      }
    }

    const builder = context.createGraphicBuilder(GraphicType.WorldDecoration);
    const purple = ColorDef.fromString("#800080");

    builder.setSymbology(purple, purple, 5,  LinePixels.Code0);
    const endIndex = this._preloadedFrustum.length - 1;
    const firstFrustum = this._preloadedFrustum[endIndex];
    if (firstFrustum) builder.addFrustum(firstFrustum);

    builder.setSymbology(purple, purple, 4,  LinePixels.Code2);
    const remainingFrustums = this._preloadedFrustum.slice(0, endIndex);
    remainingFrustums.forEach((frustum) => builder.addFrustum(frustum));

    context.addDecorationFromBuilder(builder);
  }

  public static toggle(enabled?: boolean): void {
    const instance = ViewDefinitionDecoration._instance;
    if (undefined !== enabled && (undefined !== instance) === enabled)
      return;

    if (undefined === instance) {
      ViewDefinitionDecoration._instance = new ViewDefinitionDecoration();
    } else {
      instance.stop();
      ViewDefinitionDecoration._instance = undefined;
    }
  }
}

/** Display in every viewport a green range graphic for each displayed tile tree, plus a red range graphic for each tile tree's content range if defined.
 * @beta
 */
export class ViewDefinitionDecorationTool extends Tool {
  public static override toolId = "ViewDefinitionDecorationTool";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async run(enable?: boolean): Promise<boolean> {
    ViewDefinitionDecoration.toggle(enable);
    return true;
  }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    const enable = parseToggle(args[0]);
    if (typeof enable !== "string")
      await this.run(enable);

    return true;
  }
}
