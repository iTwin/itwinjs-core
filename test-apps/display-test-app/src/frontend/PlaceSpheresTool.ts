/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef } from "@itwin/core-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, IModelApp, PrimitiveTool, RenderGraphic, TileTreeReference, TiledGraphicsProvider, Viewport } from "@itwin/core-frontend";
import { Point3d, Sphere } from "@itwin/core-geometry";

function getColor(index: number): ColorDef {
  const colors = [ColorDef.red, ColorDef.blue, ColorDef.green, ColorDef.white, ColorDef.black];
  return colors[index % colors.length];
}

export class PlaceSpheresTool extends PrimitiveTool {
  private readonly _points: Point3d[] = [];
  private _radius = 10;
  private _chordTolerance = 0.1;
  private _graphic?: RenderGraphic;
  
  public static override toolId = "DtaPlaceSpheres";

  public override requireWriteableTarget(): boolean {
    return false;
  }

  public override async onPostInstall() {
    IModelApp.accuSnap.enableSnap(true);
  }

  public override async onCleanup() {
    // ###TODO
  }

  public override async onDataButtonDown(ev: BeButtonEvent) {
    this._points.push(ev.point);
    this.updateGraphic();
    ev.viewport?.invalidateDecorations();
    return EventHandled.No;
  }

  public override async onResetButtonUp(ev: BeButtonEvent) {
    if (ev.viewport) {
      this.registerTiledGraphicsProvider(ev.viewport);
    }

    this.exitTool();
    return EventHandled.No;
  }

  private registerTiledGraphicsProvider(viewport: Viewport) {
    if (!this._graphic) {
      return;
    }

    const treeRef = TileTreeReference.createFromRenderGraphic({
      iModel: viewport.iModel,
      graphic: this._graphic,
      modelId: viewport.iModel.transientIds.getNext(),
    });

    const provider: TiledGraphicsProvider = {
      forEachTileTreeRef: (vp, func) => {
        if (vp === viewport) {
          func(treeRef);
        }
      },
    }

    viewport.addTiledGraphicsProvider(provider);
  }

  private updateGraphic() {
    if (this._points.length === 0) {
      this._graphic?.dispose();
      this._graphic = undefined;
      return;
    }

    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => this._chordTolerance,
    });

    for (let i = 0; i < this._points.length; i++) {
      const sphere = Sphere.createCenterRadius(this._points[i], this._radius);
      builder.setSymbology(getColor(i), getColor(i).withTransparency(0x7f), 1);
      builder.addSolidPrimitive(sphere);
    }

    this._graphic = builder.finish();
  }

  public override decorate(context: DecorateContext) {
    if (this._graphic) {
      context.addDecoration(GraphicType.Scene, IModelApp.renderSystem.createGraphicOwner(this._graphic));
    }
  }

  public override decorateSuspended(context: DecorateContext) {
    this.decorate(context);
  }

  public override async onRestartTool() {
    return this.exitTool();
  }
}
