/*---------------------------------------------------------------------------------------------
* Copyright (c) Bentley Systems, Incorporated. All rights reserved.
* See LICENSE.md in the project root for license terms and full copyright notice.
*--------------------------------------------------------------------------------------------*/

/** @packageDocumentation
 * @module Tools
 */

import { Id64, Id64String } from "@itwin/core-bentley";
import { Arc3d, LineSegment3d, LineString3d } from "@itwin/core-geometry";
import {
  GeometricElement3dProps, GeometryParams, GeometryStreamIterator, GeometryStreamPrimitive,
} from "@itwin/core-common";
import {
  Decorator, FeatureOverrideProvider, GraphicPrimitive, IModelApp, Tool, Viewport,
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
    case "bsurf":
    default:
      // TODO support these
      return undefined;
  }
}

class GeometryStreamDecorator implements Decorator /* ###TODO FeatureOverrideProvider */ {
  private static _instance?: GeometryStreamDecorator;

  public readonly useCachedDecorations = true;
  private readonly _graphics: GraphicInfo[];

  private constructor(graphics: GraphicInfo[]) {
    this._graphics = graphics;
  }

  public decorate(): void {
    // ###TODO
  }

  public static clear(): void {
    if (this._instance) {
      IModelApp.viewManager.dropDecorator(this._instance);
      this._instance = undefined;
    }
  }

  public static async visualizeElement(vp: Viewport, _elementId: Id64String): Promise<boolean> {
    this.clear();
    if (!vp.view.is3d()) // TODO support 2d.
      return false;

    try {

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
