/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

import { ColorDef, Feature } from "@itwin/core-common";
import { BeButtonEvent, DecorateContext, EventHandled, GraphicType, HitDetail, IModelApp, IModelConnection, PrimitiveTool, RenderGraphic, TiledGraphicsProvider, TileTreeReference, Viewport } from "@itwin/core-frontend";
import { Point3d, Sphere as SpherePrimitive } from "@itwin/core-geometry";

function getColor(index: number): ColorDef {
  const colors = [ColorDef.red, ColorDef.blue, ColorDef.green, ColorDef.white, ColorDef.black];
  return colors[index % colors.length];
}

interface Sphere {
  id: string;
  center: Point3d;
}

class Spheres {
  private readonly _radius = 10;
  private readonly _chordTolerance = 0.01;
  public readonly spheres: Sphere[] = [];
  public readonly modelId: string;

  constructor(private readonly _iModel: IModelConnection) {
    this.modelId = this._iModel.transientIds.getNext();
  }

  public add(point: Point3d) {
    this.spheres.push({
      id: this._iModel.transientIds.getNext(),
      center: point,
    });
  }

  public toGraphic(): RenderGraphic {
    const builder = IModelApp.renderSystem.createGraphic({
      type: GraphicType.Scene,
      computeChordTolerance: () => this._chordTolerance,
      pickable: {
        modelId: this.modelId,
        id: this.modelId,
      },
    });

    for (let i = 0; i < this.spheres.length; i++) {
      const entry = this.spheres[i];
      builder.setSymbology(getColor(i), getColor(i).withTransparency(0x7f), 1);
      builder.activateFeature(new Feature(entry.id));

      const sphere = SpherePrimitive.createCenterRadius(entry.center, this._radius);
      builder.addSolidPrimitive(sphere);
    }

    return builder.finish();
  }
}

export class PlaceSpheresTool extends PrimitiveTool {
  private _graphic?: RenderGraphic;
  private _spheres?: Spheres;

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
    if (!ev.viewport) {
      return EventHandled.No;
    }

    if (!this._spheres) {
      this._spheres = new Spheres(ev.viewport.iModel);
    }

    this._spheres.add(ev.point);
    this._graphic?.dispose();
    this._graphic = this._spheres.toGraphic();

    ev.viewport?.invalidateDecorations();
    return EventHandled.No;
  }

  public override async onResetButtonUp(ev: BeButtonEvent) {
    if (ev.viewport) {
      this.registerTiledGraphicsProvider(ev.viewport);
    }

    await this.exitTool();
    return EventHandled.No;
  }

  private registerTiledGraphicsProvider(viewport: Viewport) {
    const spheres = this._spheres;
    if (!this._graphic || !spheres) {
      return;
    }

    const sphereIds = spheres.spheres.map((x) => x.id);
    const treeRef = TileTreeReference.createFromRenderGraphic({
      iModel: viewport.iModel,
      graphic: this._graphic,
      modelId: spheres.modelId,
      getToolTip: async (hit: HitDetail) => {
        const index = sphereIds.indexOf(hit.sourceId);
        if (-1 !== index) {
          return Promise.resolve(`Sphere #${index + 1}`);
        } else {
          return undefined;
        }
      },
    });

    const provider: TiledGraphicsProvider = {
      forEachTileTreeRef: (vp, func) => {
        if (vp === viewport) {
          func(treeRef);
        }
      },
    };

    viewport.addTiledGraphicsProvider(provider);
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
