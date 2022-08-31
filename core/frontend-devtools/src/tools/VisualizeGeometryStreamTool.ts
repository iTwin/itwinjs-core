/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { assert, Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, LineSegment3d, LineString3d, Loop, Path } from "@itwin/core-geometry";
import {
  ColorByName, ColorDef, Feature, GeometricElement3dProps, GeometryParams, GeometryStreamIterator, GeometryStreamPrimitive,
} from "@itwin/core-common";
import {
  DecorateContext, Decorator, FeatureOverrideProvider, FeatureSymbology, GraphicPrimitive, GraphicType, HitDetail, IModelApp, Tool, Viewport,
} from "@itwin/core-frontend";

interface GraphicInfo {
  primitive: GraphicPrimitive;
  params: GeometryParams;
  geometryStreamIndex: number;
  transientId: Id64String;
}

function graphicPrimitiveFromGeometryStreamPrimitive(geom: GeometryStreamPrimitive): GraphicPrimitive | undefined {
  if ("geometryQuery" !== geom.type)
    return undefined; // TODO: use ElementGraphicsRequestProps for these

  switch (geom.geometry.geometryCategory) {
    case "polyface":
      return { polyface: geom.geometry, type: "polyface" };
    case "solid":
      return { solidPrimitive: geom.geometry, type: "solidPrimitive" };
    case "point":
      return { points: [ geom.geometry.point ], type: "pointstring" };
    case "pointCollection":
      return { points: geom.geometry.points, type: "pointstring" };
    case "curvePrimitive":
      if (geom.geometry instanceof Arc3d)
        return { arc: geom.geometry, type: "arc" };
      else if (geom.geometry instanceof LineSegment3d)
        return { points: [ geom.geometry.point0Ref, geom.geometry.point1Ref ], type: "linestring" };
      else if (geom.geometry instanceof LineString3d)
        return { points: geom.geometry.points, type: "linestring" };
      else // ###TODO support the rest...
        return undefined;
    case "curveCollection":
      if (geom.geometry instanceof Loop)
        return { loop: geom.geometry, type: "loop" };
      else if (geom.geometry instanceof Path)
        return { path: geom.geometry, type: "path" };
      else
        return undefined; // TODO support parity/union regions and bags of curves.
    case "bsurf":
      // TODO support these
      return undefined;
  }
}

function getColors(): ColorDef[] {
  return [
    ColorDef.red,
    ColorDef.green,
    ColorDef.blue,
    ColorDef.fromTbgr(ColorByName.yellow),
    ColorDef.fromTbgr(ColorByName.orange),
    ColorDef.fromTbgr(ColorByName.purple),
    ColorDef.fromTbgr(ColorByName.brown),
    ColorDef.fromTbgr(ColorByName.hotPink),
    ColorDef.fromTbgr(ColorByName.olive),
    ColorDef.fromTbgr(ColorByName.teal),
    ColorDef.fromTbgr(ColorByName.wheat),
    ColorDef.fromTbgr(ColorByName.magenta),
    ColorDef.fromTbgr(ColorByName.lightBlue),
  ];
}

class GeometryStreamDecorator implements Decorator, FeatureOverrideProvider {
  private static _instance?: GeometryStreamDecorator;

  public readonly useCachedDecorations = true;
  private readonly _graphics: GraphicInfo[];
  private readonly _elementId: Id64String;
  private readonly _dispose: () => void;

  private constructor(vp: Viewport, elementId: Id64String, graphics: GraphicInfo[]) {
    this._graphics = graphics;
    this._elementId = elementId;

    vp.addFeatureOverrideProvider(this);
    this._dispose = () => vp.dropFeatureOverrideProvider(this);

    // TODO better cleanup, e.g. remove when iModel is closed.
  }

  public testDecorationHit(id: string): boolean {
    return this._graphics.some((x) => x.transientId === id);
  }

  public async getDecorationToolTip(hit: HitDetail): Promise<string> {
    const info = this._graphics.find((x) => x.transientId === hit.sourceId);
    assert(undefined !== info);
    return `${info.primitive.type}\n${info.transientId}\n$index: ${info.geometryStreamIndex}`;
  }

  public decorate(context: DecorateContext): void {
    if (!context.viewport.view.is3d())
      return;

    const builder = context.createGraphic({
      type: GraphicType.Scene,
      pickable: { id: "" },
    });

    for (const info of this._graphics) {
      // ###TODO We have GeometryParams. We want GraphicParams. We can't cook them without talking to the backend...
      builder.activateFeature(new Feature(info.transientId, info.params.subCategoryId, info.params.geometryClass));
      const colors = getColors();
      const color = colors[info.geometryStreamIndex % colors.length];
      builder.setSymbology(color, color, 1);
      builder.addPrimitive(info.primitive);
    }

    context.addDecorationFromBuilder(builder);
  }

  public addFeatureOverrides(ovrs: FeatureSymbology.Overrides): void {
    ovrs.setNeverDrawn(this._elementId);
  }

  public static clear(): void {
    if (this._instance) {
      IModelApp.viewManager.dropDecorator(this._instance);
      this._instance._dispose();
      this._instance = undefined;
    }
  }

  public static async visualizeElement(vp: Viewport, elementId: Id64String): Promise<boolean> {
    this.clear();
    if (!vp.view.is3d()) // TODO support 2d.
      return false;

    try {
      const props = await vp.iModel.elements.loadProps(elementId, {
        wantGeometry: true,
        wantBRepData: false, // TODO when supported
      }) as GeometricElement3dProps;

      let index = 0;
      const graphics: GraphicInfo[] = [];
      for (const entry of GeometryStreamIterator.fromGeometricElement3d(props)) {
        const geometryStreamIndex = index++;
        const primitive = graphicPrimitiveFromGeometryStreamPrimitive(entry.primitive);
        if (primitive)
          graphics.push({ primitive, params: entry.geomParams, geometryStreamIndex, transientId: vp.iModel.transientIds.next });
      }

      if (0 === graphics.length)
        return false;

      this._instance = new GeometryStreamDecorator(vp, elementId, graphics);
      IModelApp.viewManager.addDecorator(this._instance);
      return true;
    } catch {
      return false;
    }
  }
}

export class VisualizeGeometryStreamTool extends Tool {
  public static override toolId = "VisualizeGeometryStream";
  public static override get minArgs() { return 0; }
  public static override get maxArgs() { return 1; }

  public override async parseAndRun(...args: string[]): Promise<boolean> {
    return this.run(args[0]);
  }

  public override async run(elementId?: string): Promise<boolean> {
    GeometryStreamDecorator.clear();
    if (typeof elementId !== "string")
      return true;

    const vp = IModelApp.viewManager.selectedView;
    if (!vp || !Id64.isValidId64(elementId))
      return false;

    return GeometryStreamDecorator.visualizeElement(vp, elementId);
  }
}
